/**
 * 监控路由 - 系统健康状态与统计数据
 * 
 * GET /api/monitor/status  - 系统各组件健康状态
 * GET /api/monitor/stats   - 发送统计与运行数据
 * 
 * 所有接口需要认证
 */
import express from 'express';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { getSystemHealth, getSystemStats } from '../services/monitorService.js';

const router = express.Router();

// 所有监控路由需要认证
router.use(authMiddleware);

/**
 * GET /status - 获取系统健康状态
 */
router.get('/status', async (req, res) => {
  try {
    const health = await getSystemHealth();
    success(res, health, '获取系统状态成功');
  } catch (err) {
    console.error('[监控] 获取系统状态失败:', err.message);
    error(res, '获取系统状态失败', 500);
  }
});

/**
 * GET /stats - 获取系统统计数据
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getSystemStats();
    success(res, stats, '获取统计数据成功');
  } catch (err) {
    console.error('[监控] 获取统计数据失败:', err.message);
    error(res, '获取统计数据失败', 500);
  }
});

export default router;
