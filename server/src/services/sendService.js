/**
 * 共享发送服务 - 统一的生日贺卡发送流程
 * 
 * 将"匹配模板 → 生成贺卡 → 创建记录 → 发送短信 → 更新状态"
 * 这一完整流程提取为公共函数，供路由和定时任务复用，消除重复代码。
 */
import { Employee, Template, Blessing, SendRecord } from '../models/index.js';
import { matchTemplate } from './templateMatcher.js';
import { generateCard } from './cardGenerator.js';
import { sendSMS } from './smsService.js';

/**
 * 为指定员工发送生日贺卡
 * 
 * @param {object} options
 * @param {number} options.employeeId - 员工ID
 * @param {number|null} [options.adminId] - 操作管理员ID（定时任务为null）
 * @param {boolean} [options.skipIfSentToday] - 是否跳过今天已成功发送的员工
 * @returns {Promise<{
 *   success: boolean,
 *   employee: object|null,
 *   template: object|null,
 *   cardUrl: string|null,
 *   cardId: string|null,
 *   smsStatus: string|null,
 *   smsProvider: string|null,
 *   messageId: string|null,
 *   error: string|null
 * }>}
 */
export const sendBirthdayCard = async ({ employeeId, adminId = null, skipIfSentToday = false }) => {
  // 1. 检查员工是否存在
  const employee = await Employee.findByPk(employeeId, {
    include: [{ model: Template, as: 'default_template', include: [{ model: Blessing, as: 'default_blessing' }] }]
  });
  if (!employee) {
    return { success: false, error: '员工不存在', employee: null, template: null, cardUrl: null, cardId: null, smsStatus: null, smsProvider: null, messageId: null };
  }

  // 可选：跳过今天已成功发送的员工
  if (skipIfSentToday) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const { Op } = await import('sequelize');
    const alreadySent = await SendRecord.findOne({
      where: {
        employee_id: employeeId,
        send_status: 'success',
        send_time: { [Op.gte]: todayStart, [Op.lt]: todayEnd }
      }
    });
    if (alreadySent) {
      return { success: true, error: '今日已发送，跳过', employee, template: null, cardUrl: null, cardId: null, smsStatus: 'success', smsProvider: null, messageId: null };
    }
  }

  // 2. 匹配模板
  const template = await matchTemplate(employee);
  if (!template) {
    return { success: false, error: '没有可用的模板', employee, template: null, cardUrl: null, cardId: null, smsStatus: null, smsProvider: null, messageId: null };
  }

  // 3. 生成贺卡
  const cardResult = await generateCard(template, employee);

  // 4. 创建待发送记录（先建记录再发短信，保证崩溃时也有据可查）
  const record = await SendRecord.create({
    employee_id: employee.id,
    template_id: template.id,
    card_url: cardResult.cardUrl,
    card_id: cardResult.cardId,
    send_status: 'pending',
    send_time: new Date(),
    admin_id: adminId
  });

  // 5. 发送短信
  const smsResult = await sendSMS(employee.phone, cardResult.cardUrl, employee.name);

  // 6. 更新记录状态
  await record.update({
    send_status: smsResult.success ? 'success' : 'failed',
    message_id: smsResult.messageId,
    sms_provider: smsResult.provider,
    retry_count: smsResult.retryCount,
    error_message: smsResult.error || null,
    send_time: new Date()
  });

  return {
    success: smsResult.success,
    employee,
    template,
    cardUrl: cardResult.cardUrl,
    cardId: cardResult.cardId,
    smsStatus: smsResult.success ? 'success' : 'failed',
    smsProvider: smsResult.provider,
    messageId: smsResult.messageId,
    error: smsResult.error || null
  };
};
