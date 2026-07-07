import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// 必须在任何其他模块导入之前加载环境变量
dotenv.config();

import { sequelize } from './config/database.js';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import templateRoutes from './routes/templates.js';
import blessingRoutes from './routes/blessings.js';
import recordRoutes from './routes/records.js';
import cardRoutes from './routes/card.js';
import departmentRoutes from './routes/departments.js';
import operationLogRoutes from './routes/operationLogs.js';
import monitorRoutes from './routes/monitor.js';
import initDefaultAdmin from './utils/initAdmin.js';
import initDefaultTemplate from './utils/initDefaultTemplate.js';
import { startBirthdayScheduler } from './services/scheduler.js';
import migrateDatabase from './utils/migrate.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保必要的目录存在
async function ensureDirectories() {
  const dirs = [config.cardsDir, config.uploadsDir];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`[启动] 创建目录失败: ${dir}`, err.message);
    }
  }
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 静态文件服务（uploads 目录下的 logo 等资源）
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// 健康检查（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'OK', data: { status: 'healthy', timestamp: new Date() } });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/blessings', blessingRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/operation-logs', operationLogRoutes);
app.use('/api/monitor', monitorRoutes);

// 贺卡访问路由（无需认证）
app.use('/card', cardRoutes);

// 全局错误处理
app.use(errorHandler);

// 启动服务
const startServer = async () => {
  try {
    // 确保工作目录存在
    await ensureDirectories();

    // 迁移：先为已存在的表添加新增列（避免 sync 创建索引时列不存在）
    await migrateDatabase();

    // 同步表结构：创建尚不存在的表
    await sequelize.sync();
    console.log('[数据库] 连接成功');

    await initDefaultAdmin();
    await initDefaultTemplate();

    // 启动定时任务
    startBirthdayScheduler();

    app.listen(config.port, () => {
      console.log(`[服务器] 运行在 http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('[启动失败]', err);
    process.exit(1);
  }
};

startServer();

export default app;