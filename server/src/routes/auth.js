import { Router } from 'express';
import { sequelize, Admin, ActiveSession } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { authMiddleware } from '../middlewares/auth.js';
import { validatePassword } from '../utils/passwordValidator.js';
import { config } from '../config/index.js';

const router = Router();

// POST /api/auth/login - 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const admin = await Admin.findOne({ where: { username } });
    if (!admin) {
      return error(res, '用户名或密码错误', 401);
    }

    // 验证密码
    const isValid = await comparePassword(password, admin.password_hash);
    if (!isValid) {
      return error(res, '用户名或密码错误', 401);
    }

    // 检查密码过期状态
    const now = new Date();
    const passwordAge = now - new Date(admin.password_changed_at);
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const passwordExpired = passwordAge > ninetyDaysMs;

    // 生成token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      display_name: admin.display_name
    });

    // 获取客户端 IP
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const userAgent = (req.headers['user-agent'] || '').substring(0, 255);

    // 计算会话过期时间（与 JWT 过期时间一致）
    const expiresAt = new Date(now.getTime() + config.sessionTimeoutMinutes * 60 * 1000);

    // 创建 ActiveSession 记录
    await ActiveSession.create({
      admin_id: admin.id,
      token,
      ip_address: ipAddress,
      user_agent: userAgent,
      last_activity: now,
      expires_at: expiresAt
    });

    // 检查并发会话数，超出限制则删除最早的会话
    const sessions = await ActiveSession.findAll({
      where: { admin_id: admin.id },
      order: [['last_activity', 'ASC']]
    });

    if (sessions.length > config.maxConcurrentSessions) {
      const toDelete = sessions.slice(0, sessions.length - config.maxConcurrentSessions);
      await ActiveSession.destroy({
        where: { id: toDelete.map(s => s.id) }
      });
    }

    success(res, {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name
      },
      must_change_password: admin.must_change_password,
      password_expired: passwordExpired
    }, '登录成功');
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/auth/profile - 获取当前用户信息（需要认证）
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.user.id, {
      attributes: ['id', 'username', 'display_name']
    });

    if (!admin) {
      return error(res, '管理员不存在', 404);
    }

    success(res, admin);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/auth/change-password - 修改密码（需要认证）
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // 验证新密码复杂度
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return error(res, validation.message, 400);
    }

    const admin = await Admin.findByPk(req.user.id);
    const isValid = await comparePassword(oldPassword, admin.password_hash);

    if (!isValid) {
      return error(res, '原密码错误', 400);
    }

    const password_hash = await hashPassword(newPassword);
    await Admin.update(
      {
        password_hash,
        password_changed_at: new Date(),
        must_change_password: false
      },
      { where: { id: req.user.id } }
    );

    success(res, null, '密码修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/auth/verify-password - 验证当前密码（需要认证）
router.post('/verify-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return error(res, '请提供密码', 400);
    }

    const admin = await Admin.findByPk(req.user.id);
    const isValid = await comparePassword(password, admin.password_hash);

    success(res, { valid: isValid });
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/auth/logout - 退出登录（需要认证）
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    // 删除当前会话记录
    await ActiveSession.destroy({ where: { token } });

    success(res, null, '退出登录成功');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;
