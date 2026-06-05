// 定时任务服务
import cron from 'node-cron';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, SendRecord } from '../models/index.js';
import { sendBirthdayCard } from './sendService.js';

/**
 * 启动生日定时任务
 */
export const startBirthdayScheduler = () => {
  // 每天早上8点执行
  cron.schedule('0 8 * * *', async () => {
    console.log('[定时任务] 开始检查今日生日员工...');
    
    try {
      await processBirthdayEmployees();
      console.log('[定时任务] 生日贺卡发送完成');
    } catch (err) {
      console.error('[定时任务] 执行失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  console.log('[定时任务] 已启动生日检查定时任务');
};

/**
 * 处理今日生日员工
 * 
 * 流程：查询今日生日员工 -> 逐个调用共享发送服务
 * 发送服务内部会完成：匹配模板 → 生成贺卡 → 创建记录 → 发送短信 → 更新状态
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

  // 2. 逐个处理（共享发送函数内部已包含重复发送检查）
  for (const employee of birthdayEmployees) {
    try {
      const result = await sendBirthdayCard({ employeeId: employee.id, skipIfSentToday: true });

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
