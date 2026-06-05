import express from 'express';
import { Op } from 'sequelize';
import { success, error } from '../utils/response.js';
import { SendRecord, Employee, Template } from '../models/index.js';
import { authMiddleware } from '../middlewares/auth.js';
import { sendBirthdayCard } from '../services/sendService.js';

const router = express.Router();

// 所有记录路由需要认证
router.use(authMiddleware);

// 获取发送记录列表（分页、筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, employeeId, status, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const sizeNum = parseInt(pageSize);
    const offset = (pageNum - 1) * sizeNum;
    
    const where = {};
    
    // 筛选条件
    if (employeeId) where.employee_id = employeeId;
    if (status) where.send_status = status;
    if (startDate || endDate) {
      where.send_time = {};
      // 使用本地时间解析，避免 UTC 截断问题（与 scheduler.js 保持一致）
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        where.send_time[Op.gte] = new Date(y, m - 1, d);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        where.send_time[Op.lte] = new Date(y, m - 1, d, 23, 59, 59);
      }
    }
    
    const { count, rows } = await SendRecord.findAndCountAll({
      where,
      include: [{
        model: Employee,
        as: 'employee',
        attributes: ['name', 'department', 'phone']
      }, {
        model: Template,
        as: 'template',
        attributes: ['name']
      }],
      order: [['created_at', 'DESC']],
      offset,
      limit: sizeNum
    });
    
    success(res, {
      list: rows,
      total: count,
      page: pageNum,
      pageSize: sizeNum
    });
  } catch (err) {
    error(res, err.message);
  }
});

// 获取统计数据
router.get('/stats', async (req, res) => {
  try {
    const total = await SendRecord.count();
    const successCount = await SendRecord.count({ where: { send_status: 'success' } });
    const failedCount = await SendRecord.count({ where: { send_status: 'failed' } });
    
    success(res, {
      total,
      success: successCount,
      failed: failedCount,
      success_rate: total ? parseFloat(((successCount / total) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    error(res, err.message);
  }
});

// 手动测试发送（完整流程：匹配模板 -> 生成贺卡 -> 发送短信 -> 创建记录）
router.post('/test-send/:employeeId', async (req, res) => {
  try {
    const result = await sendBirthdayCard({ employeeId: req.params.employeeId, adminId: req.user.id });

    if (!result.employee) {
      return error(res, result.error, 404);
    }
    if (!result.template) {
      return error(res, result.error, 400);
    }

    success(res, {
      employee: result.employee.name,
      template: result.template.name,
      cardUrl: result.cardUrl,
      smsStatus: result.smsStatus,
      smsProvider: result.smsProvider,
      messageId: result.messageId,
      smsError: result.error
    }, result.success ? '测试发送成功' : '贺卡生成成功，短信发送失败');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;