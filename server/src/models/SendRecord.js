import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SendRecord = sequelize.define('SendRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  template_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'templates',
      key: 'id'
    }
  },
  card_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  card_id: {
    type: DataTypes.STRING(100)
  },
  send_status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending'
  },
  send_time: {
    type: DataTypes.DATE
  },
  admin_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'admins',
      key: 'id'
    }
  },
  error_message: {
    type: DataTypes.TEXT
  },
  // --- 短信发送追踪字段 ---
  // 注意：如果数据库已存在 send_records 表，Sequelize sync 不会自动添加新列
  // 开发阶段可删除数据库重建，或手动执行以下SQL：
  //   ALTER TABLE send_records ADD COLUMN message_id VARCHAR(200);
  //   ALTER TABLE send_records ADD COLUMN sms_provider VARCHAR(20);
  //   ALTER TABLE send_records ADD COLUMN retry_count INT DEFAULT 0;
  message_id: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  sms_provider: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sms_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // --- 冗余字段：方便查询时直接显示，无需关联 ---
  template_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  blessing_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // --- 视频相关字段 ---
  video_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '视频文件路径（MMS发送时）'
  },
  send_type: {
    type: DataTypes.ENUM('sms', 'mms', '5g_video'),
    defaultValue: 'sms',
    comment: '发送类型：sms=纯短信, mms=彩信含视频, 5g_video=5G视信'
  },
  // --- CSP 回调状态字段 ---
  csp_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'CSP平台送达状态：DeliveredToNetwork/DeliveredToTerminal/DeliveryFailed等'
  },
  csp_contribution_id: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'CSP contributionID，用于关联回调状态'
  }
}, {
  tableName: 'send_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default SendRecord;
