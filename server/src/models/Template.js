import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255)
  },
  match_gender: {
    type: DataTypes.ENUM('male', 'female', 'all'),
    defaultValue: 'all'
  },
  match_age_min: {
    type: DataTypes.INTEGER
  },
  match_age_max: {
    type: DataTypes.INTEGER
  },
  match_interests: {
    type: DataTypes.STRING(255)
  },
  html_content: {
    type: DataTypes.TEXT('medium'),
    allowNull: false
  },
  default_blessing_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preview_image: {
    type: DataTypes.STRING(255)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Template;