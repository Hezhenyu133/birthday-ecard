/**
 * 监控服务 - 系统健康检查与统计
 * 
 * 提供系统各组件的健康状态检测和运行统计数据，
 * 供前端系统状态页面和 API 接口调用。
 */
import { Op, fn, col, literal } from 'sequelize';
import { sequelize, SendRecord, Employee } from '../models/index.js';
import { getSenderHeartbeat } from './heartbeatService.js';

// 心跳超时阈值：2 小时（毫秒）
const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * 检查发送服务健康状态
 * @returns {Promise<'healthy'|'unhealthy'>}
 */
export const checkSenderHealth = async () => {
  const lastBeat = await getSenderHeartbeat();
  if (!lastBeat) {
    return 'unhealthy';
  }

  const beatTime = new Date(lastBeat);
  const now = new Date();
  const elapsed = now - beatTime;

  return elapsed <= HEARTBEAT_TIMEOUT_MS ? 'healthy' : 'unhealthy';
};

/**
 * 获取系统整体健康状态
 * @returns {Promise<{
 *   sender_service: string,
 *   monitor_service: string,
 *   database: string,
 *   last_heartbeat: string|null
 * }>}
 */
export const getSystemHealth = async () => {
  // 检查发送服务
  const senderStatus = await checkSenderHealth();
  const lastHeartbeat = await getSenderHeartbeat();

  // 检查数据库连接
  let dbStatus = 'disconnected';
  try {
    await sequelize.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return {
    sender_service: senderStatus,
    monitor_service: 'healthy',  // 监控服务自身正在运行，所以是 healthy
    database: dbStatus,
    last_heartbeat: lastHeartbeat
  };
};

/**
 * 获取系统运行统计数据
 * @returns {Promise<object>}
 */
export const getSystemStats = async () => {
  // 1. 发送统计：总数、成功数、失败数、成功率
  const totalSends = await SendRecord.count();
  const successCount = await SendRecord.count({ where: { send_status: 'success' } });
  const failedCount = await SendRecord.count({ where: { send_status: 'failed' } });
  const successRate = totalSends > 0 ? Math.round((successCount / totalSends) * 10000) / 100 : 0;

  const send_stats = {
    total: totalSends,
    success: successCount,
    failed: failedCount,
    success_rate: successRate
  };

  // 2. 模板使用统计：按 template_name 分组计数
  const templateUsageRaw = await SendRecord.findAll({
    attributes: [
      'template_name',
      [fn('COUNT', '*'), 'count']
    ],
    where: {
      template_name: { [Op.ne]: null }
    },
    group: ['template_name'],
    raw: true
  });

  const template_usage = templateUsageRaw.map(row => ({
    template_name: row.template_name,
    count: parseInt(row.count)
  }));

  // 3. 今日发送数量
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const today_count = await SendRecord.count({
    where: {
      send_time: { [Op.gte]: todayStart, [Op.lte]: todayEnd }
    }
  });

  // 4. 按员工等级统计发送量（SendRecord 关联 Employee）
  const levelStatsRaw = await SendRecord.findAll({
    attributes: [
      [literal('`employee`.`level`'), 'level'],
      [fn('COUNT', '*'), 'count']
    ],
    include: [{
      model: Employee,
      as: 'employee',
      attributes: []
    }],
    group: [literal('`employee`.`level`')],
    raw: true
  });

  const level_stats = levelStatsRaw.map(row => ({
    level: row.level || 'unknown',
    count: parseInt(row.count)
  }));

  return {
    send_stats,
    template_usage,
    today_count,
    level_stats
  };
};
