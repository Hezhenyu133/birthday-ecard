import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// ES 模块中 import 先于模块体执行，必须在此处提前加载 .env
const __dbFile = fileURLToPath(import.meta.url);
const __dbDir = path.dirname(__dbFile);
dotenv.config({ path: path.join(__dbDir, '../../.env') });

import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    timezone: '+08:00',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      charset: 'utf8mb4'
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);