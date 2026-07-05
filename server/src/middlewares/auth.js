import { verifyToken } from '../utils/jwt.js';
import { success, error } from '../utils/response.js';
import { ActiveSession } from '../models/index.js';

// JWT认证中间件
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未提供认证Token', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // 检查 ActiveSession 表，确认会话有效
    const session = await ActiveSession.findOne({ where: { token } });
    if (!session) {
      return error(res, '会话已失效，请重新登录', 401);
    }

    // 更新最后活动时间
    await session.update({ last_activity: new Date() });

    req.user = decoded; // 将用户信息挂载到request
    next();
  } catch (err) {
    return error(res, 'Token无效或已过期', 401);
  }
};