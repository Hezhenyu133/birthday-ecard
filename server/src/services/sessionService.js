import { ActiveSession } from '../models/index.js';
import { config } from '../config/index.js';
import { Op } from 'sequelize';

/**
 * 清理过期会话
 * 删除 expires_at 已过期 或 last_activity 超过 sessionTimeoutMinutes 的会话记录
 */
export const cleanupExpiredSessions = async () => {
  try {
    const now = new Date();
    const timeoutMs = config.sessionTimeoutMinutes * 60 * 1000;
    const activityCutoff = new Date(now.getTime() - timeoutMs);

    const deleted = await ActiveSession.destroy({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lt]: now } },
          { last_activity: { [Op.lt]: activityCutoff } }
        ]
      }
    });

    if (deleted > 0) {
      console.log(`[会话清理] 已清理 ${deleted} 个过期会话`);
    }

    return deleted;
  } catch (err) {
    console.error('[会话清理] 清理失败:', err.message);
    return 0;
  }
};
