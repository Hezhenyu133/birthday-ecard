// 数据库迁移工具 - 确保已存在的表拥有新增列
// sequelize.sync() 不会为已存在的表添加新列，此工具弥补该缺陷
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

const MIGRATIONS = [
  // send_records 表的 SMS 追踪字段（后续版本新增）
  {
    table: 'send_records',
    column: 'message_id',
    sql: "ALTER TABLE send_records ADD COLUMN message_id VARCHAR(200) NULL"
  },
  {
    table: 'send_records',
    column: 'sms_provider',
    sql: "ALTER TABLE send_records ADD COLUMN sms_provider VARCHAR(20) NULL"
  },
  {
    table: 'send_records',
    column: 'retry_count',
    sql: "ALTER TABLE send_records ADD COLUMN retry_count INT DEFAULT 0"
  },
  {
    table: 'templates',
    column: 'default_blessing_id',
    sql: "ALTER TABLE templates ADD COLUMN default_blessing_id INT NULL"
  },
  // templates 表 html_content 列从 TEXT 升级为 MEDIUMTEXT（支持大型 HTML 模板）
  {
    table: 'templates',
    column: 'html_content_mediumtext',
    checkSql: `
      SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'templates' AND COLUMN_NAME = 'html_content'
      AND DATA_TYPE = 'mediumtext'
    `,
    sql: "ALTER TABLE templates MODIFY COLUMN html_content MEDIUMTEXT NOT NULL"
  }
];

const migrateDatabase = async () => {
  let applied = 0;

  for (const migration of MIGRATIONS) {
    try {
      // 支持自定义检查 SQL（如检查列类型），否则默认检查列是否存在
      const checkSql = migration.checkSql || `
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${migration.table}' AND COLUMN_NAME = '${migration.column}'
      `;
      const [results] = await sequelize.query(checkSql, {
        type: QueryTypes.SELECT
      });

      if (!results) {
        await sequelize.query(migration.sql);
        applied++;
        console.log(`[迁移] 已应用: ${migration.table} - ${migration.column}`);
      }
    } catch (err) {
      // 忽略错误（表不存在等情况）
      console.warn(`[迁移] ${migration.table}.${migration.column} 跳过: ${err.message}`);
    }
  }

  if (applied > 0) {
    console.log(`[迁移] 完成，共应用 ${applied} 项迁移`);
  }
};

export default migrateDatabase;
