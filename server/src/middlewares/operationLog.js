/**
 * 操作日志中间件
 * 提供日志记录工具函数，在各 CRUD 路由中按需调用
 */
import { OperationLog } from '../models/index.js';

/**
 * 记录操作日志
 * @param {object} options
 * @param {number|null} options.admin_id - 操作者 ID（从 req.user?.id 获取）
 * @param {string} options.action - 操作类型：create / update / delete
 * @param {string} options.model - 操作模型：Employee / Template / Blessing / Department 等
 * @param {number|null} [options.model_id] - 被操作记录的 ID
 * @param {object|string|null} [options.details] - 操作详情（JSON 或字符串）
 * @param {string} [options.ip_address] - 请求 IP
 * @param {string} [options.user_agent] - 浏览器 UA
 */
export const logOperation = async ({ admin_id, action, model, model_id = null, details = null, ip_address = null, user_agent = null }) => {
  try {
    await OperationLog.create({
      admin_id,
      action,
      model,
      model_id,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
      ip_address,
      user_agent
    });
  } catch (err) {
    // 日志记录失败不应影响主业务，仅打印警告
    console.warn('[操作日志] 记录失败:', err.message);
  }
};

/**
 * 从 Express req 中提取公共日志字段
 * @param {import('express').Request} req
 * @returns {{ admin_id: number|null, ip_address: string|null, user_agent: string|null }}
 */
export const extractLogInfo = (req) => ({
  admin_id: req.user?.id || null,
  ip_address: req.ip || req.headers['x-forwarded-for'] || null,
  user_agent: (req.headers['user-agent'] || '').substring(0, 255)
});
