/**
 * 共享发送服务 - 统一的生日贺卡发送流程
 * 
 * 将"匹配模板 → 生成贺卡 → 创建记录 → 发送短信 → 更新状态"
 * 这一完整流程提取为公共函数，供路由和定时任务复用，消除重复代码。
 */
import { Op } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';
import { sequelize, Employee, Template, Blessing, SendRecord } from '../models/index.js';
import { matchTemplate } from './templateMatcher.js';
import { generateCard } from './cardGenerator.js';
import { sendSMS } from './smsService.js';
import { config } from '../config/index.js';

/**
 * 构建短信内容文本
 * @param {string} employeeName - 员工姓名
 * @param {string} cardUrl - 贺卡链接
 * @returns {string} 短信正文
 */
const buildSmsBody = (employeeName, cardUrl) => {
  return `亲爱的${employeeName}，祝您生日快乐！点击查看您的专属贺卡：${cardUrl}`;
};

/**
 * 异步延迟工具函数
 * @param {number} ms - 延迟毫秒数
 */
const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * 带指数退避的短信发送包装器
 * 
 * 当 sendSMS 返回 success=false 时自动重试，最多 3 次：
 * 第1次重试等待 1s，第2次等待 2s，第3次等待 4s
 * 
 * @param {string} phone - 手机号
 * @param {string} cardUrl - 贺卡链接
 * @param {string} employeeName - 员工姓名
 * @returns {Promise<object>} SMS 发送结果
 */
const sendSMSWithRetry = async (phone, cardUrl, employeeName) => {
  const maxRetries = 3;
  let smsResult;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    smsResult = await sendSMS(phone, cardUrl, employeeName);

    if (smsResult.success) {
      // 成功时记录在 sendService 层面的实际重试次数
      smsResult.retryCount = attempt;
      return smsResult;
    }

    if (attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[发送服务重试] 第 ${attempt + 1}/${maxRetries} 次重试，等待 ${waitTime}ms，原因: ${smsResult.error}`);
      await delay(waitTime);
    }
  }

  // 所有重试均失败
  smsResult.retryCount = maxRetries;
  console.error(`[发送服务] 短信发送已重试 ${maxRetries} 次仍然失败: ${smsResult.error}`);
  return smsResult;
};

/**
 * 为指定员工发送生日贺卡
 * 
 * @param {object} options
 * @param {number} options.employeeId - 员工ID
 * @param {number|null} [options.adminId] - 操作管理员ID（定时任务为null）
 * @param {boolean} [options.skipIfSentToday] - 是否跳过今天已成功发送的员工
 * @param {object[]} [options.preloadedTemplates] - 预加载的模板列表（避免N+1查询）
 * @returns {Promise<{
 *   success: boolean,
 *   employee: object|null,
 *   template: object|null,
 *   cardUrl: string|null,
 *   cardId: string|null,
 *   smsStatus: string|null,
 *   smsProvider: string|null,
 *   messageId: string|null,
 *   smsContent: string|null,
 *   employeeName: string|null,
 *   templateName: string|null,
 *   error: string|null
 * }>}
 */
export const sendBirthdayCard = async ({ employeeId, adminId = null, skipIfSentToday = false, preloadedTemplates = null }) => {
  const fail = (errorMsg, extra = {}) => ({
    success: false, error: errorMsg,
    employee: null, template: null, cardUrl: null, cardId: null,
    smsStatus: null, smsProvider: null, messageId: null, smsContent: null,
    employeeName: null, templateName: null,
    ...extra
  });

  // 1. 检查员工是否存在
  const employee = await Employee.findByPk(employeeId, {
    include: [{ model: Template, as: 'default_template', include: [{ model: Blessing, as: 'default_blessing' }] }]
  });
  if (!employee) {
    return fail('员工不存在');
  }

  const employeeName = employee.name;

  // 可选：跳过今天已成功发送的员工
  if (skipIfSentToday) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const alreadySent = await SendRecord.findOne({
      where: {
        employee_id: employeeId,
        send_status: 'success',
        send_time: { [Op.gte]: todayStart, [Op.lt]: todayEnd }
      }
    });
    if (alreadySent) {
      return {
        success: true, error: '今日已发送，跳过',
        employee, template: null, cardUrl: null, cardId: null,
        smsStatus: 'success', smsProvider: null, messageId: null, smsContent: null,
        employeeName, templateName: null
      };
    }
  }

  // 2. 匹配模板
  const template = await matchTemplate(employee, preloadedTemplates);
  if (!template) {
    return fail('没有可用的模板', { employee, employeeName });
  }

  const templateName = template.name;
  let cardResult = null;

  try {
    // 3. 生成贺卡
    cardResult = await generateCard(template, employee);

    // 4-6. 数据库操作使用事务保护
    const smsBody = buildSmsBody(employeeName, cardResult.cardUrl);
    const record = await sequelize.transaction(async (t) => {
      // 4. 创建待发送记录
      const newRecord = await SendRecord.create({
        employee_id: employee.id,
        template_id: template.id,
        card_url: cardResult.cardUrl,
        card_id: cardResult.cardId,
        send_status: 'pending',
        send_time: new Date(),
        admin_id: adminId,
        sms_content: smsBody
      }, { transaction: t });

      // 5. 发送短信（带重试机制）
      const smsResult = await sendSMSWithRetry(employee.phone, cardResult.cardUrl, employeeName);

      // 6. 更新记录状态
      await newRecord.update({
        send_status: smsResult.success ? 'success' : 'failed',
        message_id: smsResult.messageId,
        sms_provider: smsResult.provider,
        retry_count: smsResult.retryCount,
        error_message: smsResult.error || null,
        send_time: new Date()
      }, { transaction: t });

      return { record: newRecord, smsResult };
    });

    return {
      success: record.smsResult.success,
      employee,
      template,
      cardUrl: cardResult.cardUrl,
      cardId: cardResult.cardId,
      smsStatus: record.smsResult.success ? 'success' : 'failed',
      smsProvider: record.smsResult.provider,
      messageId: record.smsResult.messageId,
      smsContent: smsBody,
      employeeName,
      templateName,
      error: record.smsResult.error || null
    };
  } catch (err) {
    // 事务失败或生成失败时清理已生成的 HTML 文件
    if (cardResult?.cardId) {
      const filePath = path.join(config.cardsDir, `${cardResult.cardId}.html`);
      await fs.unlink(filePath).catch(() => {});
    }
    throw err;
  }
};
