// 数据库迁移工具 - 确保已存在的表拥有新增列
// sequelize.sync() 不会为已存在的表添加新列，此工具弥补该缺陷
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

const MIGRATIONS = [
  // ===== send_records 表的 SMS 追踪字段 =====
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
  // ===== templates 表字段 =====
  {
    table: 'templates',
    column: 'default_blessing_id',
    sql: "ALTER TABLE templates ADD COLUMN default_blessing_id INT NULL"
  },
  {
    table: 'templates',
    column: 'html_content_mediumtext',
    checkSql: `
      SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'templates' AND COLUMN_NAME = 'html_content'
      AND DATA_TYPE = 'mediumtext'
    `,
    sql: "ALTER TABLE templates MODIFY COLUMN html_content MEDIUMTEXT NOT NULL"
  },
  {
    table: 'templates',
    column: 'employee_level',
    sql: "ALTER TABLE templates ADD COLUMN employee_level ENUM('management','manager','employee','all') DEFAULT 'all'"
  },
  {
    table: 'templates',
    column: 'page_count',
    sql: "ALTER TABLE templates ADD COLUMN page_count INT DEFAULT 4"
  },
  {
    table: 'templates',
    column: 'template_type',
    sql: "ALTER TABLE templates ADD COLUMN template_type ENUM('official','festive','elegant','modern') NULL"
  },

  // ===== employees 表字段 =====
  {
    table: 'employees',
    column: 'department_id',
    sql: "ALTER TABLE employees ADD COLUMN department_id INT NULL"
  },
  {
    table: 'employees',
    column: 'department_code',
    sql: "ALTER TABLE employees ADD COLUMN department_code VARCHAR(50) NULL"
  },
  {
    table: 'employees',
    column: 'level',
    sql: "ALTER TABLE employees ADD COLUMN level ENUM('management','manager','employee') DEFAULT 'employee'"
  },

  // ===== blessings 表字段 =====
  {
    table: 'blessings',
    column: 'match_employee_level',
    sql: "ALTER TABLE blessings ADD COLUMN match_employee_level ENUM('management','manager','employee','all') DEFAULT 'all'"
  },

  // ===== send_records 表冗余字段 =====
  {
    table: 'send_records',
    column: 'template_name',
    sql: "ALTER TABLE send_records ADD COLUMN template_name VARCHAR(100) NULL"
  },
  {
    table: 'send_records',
    column: 'blessing_content',
    sql: "ALTER TABLE send_records ADD COLUMN blessing_content TEXT NULL"
  },

  // ===== admins 表字段 =====
  {
    table: 'admins',
    column: 'is_active',
    sql: "ALTER TABLE admins ADD COLUMN is_active TINYINT(1) DEFAULT 1"
  },

  // ===== send_records.template_id 从 NOT NULL 改为 NULL =====
  {
    table: 'send_records',
    column: 'template_id_nullable',
    checkSql: `
      SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'send_records' AND COLUMN_NAME = 'template_id'
      AND IS_NULLABLE = 'YES'
    `,
    sql: "ALTER TABLE send_records MODIFY COLUMN template_id INT NULL"
  },

  // ===== admins 表密码安全字段 =====
  {
    table: 'admins',
    column: 'password_changed_at',
    sql: "ALTER TABLE admins ADD COLUMN password_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
  },
  {
    table: 'admins',
    column: 'must_change_password',
    sql: "ALTER TABLE admins ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1"
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
