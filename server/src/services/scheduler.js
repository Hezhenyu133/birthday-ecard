// 定时任务服务
import cron from 'node-cron';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, SendRecord, Template, Blessing, OperationLog } from '../models/index.js';
import { sendBirthdayCard } from './sendService.js';
import { updateSenderHeartbeat, updateMonitorHeartbeat, getSenderHeartbeat, initSenderHeartbeat } from './heartbeatService.js';
import { cleanupExpiredSessions } from './sessionService.js';
import { config } from '../config/index.js';

/**
 * 启动所有定时任务
 */
export const startBirthdayScheduler = async () => {
  // 初始化发送服务心跳（避免首次启动时显示 unhealthy）
  await initSenderHeartbeat();

  // ========== 1. 每天早上8点：处理生日员工 ==========
  cron.schedule('0 8 * * *', async () => {
    console.log('[定时任务] 开始检查今日生日员工...');
    
    try {
      await processBirthdayEmployees();
      // 发送成功后更新心跳
      await updateSenderHeartbeat();
      console.log('[定时任务] 生日贺卡发送完成，心跳已更新');
    } catch (err) {
      console.error('[定时任务] 执行失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // ========== 2. 每30秒：监控服务检查发送服务心跳 ==========
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await updateMonitorHeartbeat();

      const lastBeat = await getSenderHeartbeat();
      if (!lastBeat) {
        // 还没有心跳记录，可能还没执行过发送任务，忽略
        return;
      }

      const beatTime = new Date(lastBeat);
      const now = new Date();
      const hoursSinceBeat = (now - beatTime) / (1000 * 60 * 60);

      if (hoursSinceBeat > 2) {
        console.warn(
          `[监控警告] 发送服务心跳已超过 ${hoursSinceBeat.toFixed(1)} 小时未更新！` +
          `最后心跳时间: ${lastBeat}`
        );
      }
    } catch (err) {
      console.error('[监控] 心跳检查失败:', err.message);
    }
  });

  // ========== 3. 每天凌晨2点：清理过期操作日志 ==========
  cron.schedule('0 2 * * *', async () => {
    console.log('[定时任务] 开始清理过期操作日志...');
    try {
      const retentionDays = config.logRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleted = await OperationLog.destroy({
        where: {
          created_at: { [Op.lt]: cutoffDate }
        }
      });

      console.log(`[定时任务] 已清理 ${deleted} 条超过 ${retentionDays} 天的操作日志`);
    } catch (err) {
      console.error('[定时任务] 日志清理失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // ========== 4. 每天凌晨3点：清理过期会话 ==========
  cron.schedule('0 3 * * *', async () => {
    console.log('[定时任务] 开始清理过期会话...');
    try {
      await cleanupExpiredSessions();
      console.log('[定时任务] 过期会话清理完成');
    } catch (err) {
      console.error('[定时任务] 会话清理失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  console.log('[定时任务] 已启动所有定时任务（生日检查/监控/日志清理/会话清理）');
};

/**
 * 处理今日生日员工
 * 
 * 流程：查询今日生日员工 -> 逐个调用共享发送服务
 * 发送服务内部已包含：匹配模板 → 生成贺卡 → 创建记录 → 发送短信（含重试） → 更新状态
 */
export const processBirthdayEmployees = async () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // 1. 查询今天生日的员工
  const birthdayEmployees = await Employee.findAll({
    where: {
      is_active: true,
      [Op.and]: [
        sequelize.where(sequelize.fn('MONTH', sequelize.col('birthday')), month),
        sequelize.where(sequelize.fn('DAY', sequelize.col('birthday')), day)
      ]
    }
  });

  console.log(`[定时任务] 找到 ${birthdayEmployees.length} 位今日生日员工`);

  // 2. 预加载所有激活模板（避免循环内 N+1 查询）
  const preloadedTemplates = await Template.findAll({
    where: { is_active: true },
    include: [{
      model: Blessing,
      as: 'default_blessing'
    }]
  });

  // 3. 逐个处理（共享发送函数内部已包含重复发送检查）
  for (const employee of birthdayEmployees) {
    try {
      const result = await sendBirthdayCard({ employeeId: employee.id, skipIfSentToday: true, preloadedTemplates });

      if (result.error === '今日已发送，跳过') {
        console.log(`[定时任务] 员工 ${employee.name} 今日已发送，跳过`);
        continue;
      }

      if (result.success) {
        console.log(`[定时任务] 已为员工 ${employee.name} 生成贺卡并发送短信 (${result.smsProvider})`);
      } else {
        console.warn(`[定时任务] 员工 ${employee.name} 发送失败: ${result.error}`);
      }
    } catch (err) {
      console.error(`[定时任务] 处理员工 ${employee.name} 失败:`, err.message);
    }
  }
};
