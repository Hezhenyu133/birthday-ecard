import { Router } from 'express';
import { Op } from 'sequelize';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { OperationLog, Admin } from '../models/index.js';
import { config } from '../config/index.js';

const router = Router();
router.use(authMiddleware);

// GET /api/operation-logs - 分页查询操作日志
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where = {};

    // 按操作类型筛选
    if (req.query.action) {
      where.action = req.query.action;
    }

    // 按操作模型筛选
    if (req.query.model) {
      where.model = req.query.model;
    }

    // 按操作者筛选
    if (req.query.admin_id) {
      where.admin_id = parseInt(req.query.admin_id);
    }

    // 按时间范围筛选
    if (req.query.startDate) {
      where.created_at = where.created_at || {};
      where.created_at[Op.gte] = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      where.created_at = where.created_at || {};
      where.created_at[Op.lte] = new Date(req.query.endDate);
    }

    const { count, rows } = await OperationLog.findAndCountAll({
      where,
      include: [{
        model: Admin,
        as: 'admin',
        attributes: ['id', 'username', 'display_name']
      }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      list: rows.map(log => ({
        id: log.id,
        admin_id: log.admin_id,
        admin_name: log.admin?.display_name || '未知',
        admin_username: log.admin?.username || '-',
        action: log.action,
        model: log.model,
        model_id: log.model_id,
        details: log.details,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at
      })),
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    console.error('[操作日志] 查询失败:', err.message);
    return error(res, '查询操作日志失败', 500);
  }
});

// GET /api/operation-logs/stats - 简单统计
router.get('/stats', async (req, res) => {
  try {
    const { sequelize } = OperationLog;

    // 按操作类型统计
    const [actionStats] = await sequelize.query(
      'SELECT action, COUNT(*) as count FROM operation_logs GROUP BY action ORDER BY count DESC'
    );

    // 按操作模型统计
    const [modelStats] = await sequelize.query(
      'SELECT model, COUNT(*) as count FROM operation_logs GROUP BY model ORDER BY count DESC'
    );

    // 今日操作数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM operation_logs WHERE created_at >= ?',
      { replacements: [today] }
    );

    // 总记录数
    const [totalCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM operation_logs'
    );

    return success(res, {
      action_stats: actionStats,
      model_stats: modelStats,
      today_count: todayCount[0]?.count || 0,
      total_count: totalCount[0]?.count || 0
    });
  } catch (err) {
    console.error('[操作日志] 统计失败:', err.message);
    return error(res, '查询统计失败', 500);
  }
});

// DELETE /api/operation-logs/cleanup - 清理过期日志
router.delete('/cleanup', async (req, res) => {
  try {
    const retentionDays = config.logRetentionDays || 60;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await OperationLog.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate }
      }
    });

    return success(res, { deleted_count: deleted }, `已清理 ${deleted} 条 ${retentionDays} 天前的日志`);
  } catch (err) {
    console.error('[操作日志] 清理失败:', err.message);
    return error(res, '清理日志失败', 500);
  }
});

export default router;
