import Admin from './Admin.js';
import Employee from './Employee.js';
import Template from './Template.js';
import Blessing from './Blessing.js';
import SendRecord from './SendRecord.js';
import Department from './Department.js';
import OperationLog from './OperationLog.js';
import ActiveSession from './ActiveSession.js';
import { sequelize } from '../config/database.js';

// ========== 原有关系 ==========

Admin.hasMany(SendRecord, { foreignKey: 'admin_id', as: 'records' });
SendRecord.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

Employee.hasMany(SendRecord, { foreignKey: 'employee_id', as: 'records' });
SendRecord.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Template.hasMany(SendRecord, { foreignKey: 'template_id', as: 'records' });
SendRecord.belongsTo(Template, { foreignKey: 'template_id', as: 'template' });

Template.belongsTo(Blessing, { foreignKey: 'default_blessing_id', as: 'default_blessing' });
Blessing.hasMany(Template, { foreignKey: 'default_blessing_id', as: 'templates' });

Template.hasMany(Employee, { foreignKey: 'default_template_id', as: 'employees' });
Employee.belongsTo(Template, { foreignKey: 'default_template_id', as: 'default_template' });

// ========== 部门关系 ==========

// Department 自引用：父部门 → 子部门
Department.hasMany(Department, { foreignKey: 'parent_id', as: 'children' });
Department.belongsTo(Department, { foreignKey: 'parent_id', as: 'parent' });

// Department → Employee：一个部门有多个员工
Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'dept' });

// ========== 操作日志关系 ==========

Admin.hasMany(OperationLog, { foreignKey: 'admin_id', as: 'operation_logs' });
OperationLog.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// ========== 在线会话关系 ==========

Admin.hasMany(ActiveSession, { foreignKey: 'admin_id', as: 'sessions' });
ActiveSession.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

export {
  sequelize,
  Admin,
  Employee,
  Template,
  Blessing,
  SendRecord,
  Department,
  OperationLog,
  ActiveSession
};
