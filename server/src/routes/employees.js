import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { sequelize, Employee, Template, Blessing, SendRecord, Department } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { parseEmployeeExcel, validateEmployee } from '../utils/excelParser.js';
import { Op } from 'sequelize';
import { logOperation, extractLogInfo } from '../middlewares/operationLog.js';
import { sendBirthdayCard } from '../services/sendService.js';
import { autoAssignTemplateToEmployee, pickRandomUniversalTemplate } from '../services/autoMatch.js';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

const router = Router();

// 所有员工路由需要认证
router.use(authMiddleware);

// 配置文件上传（使用绝对路径，避免 CWD 不一致问题）
const upload = multer({
  dest: UPLOAD_DIR,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel和CSV文件'));
    }
  }
});

/**
 * 白名单过滤：防止mass assignment攻击
 */
const EMPLOYEE_FIELDS = ['name', 'gender', 'birthday', 'phone', 'department', 'position', 'defaultTemplateId', 'default_template_id', 'department_id', 'department_code', 'level'];

const sanitizeEmployeeInput = (obj) => {
  const sanitized = {};
  for (const key of EMPLOYEE_FIELDS) {
    if (obj.hasOwnProperty(key)) {
      // 统一转换为 snake_case 数据库字段名
      let dbKey = key;
      if (key === 'defaultTemplateId') dbKey = 'default_template_id';
      sanitized[dbKey] = obj[key];
    }
  }
  return sanitized;
};

/**
 * 递归获取部门及其所有子部门的 ID 列表
 */
const getDepartmentAndDescendantIds = async (deptId) => {
  const ids = [deptId];
  const children = await Department.findAll({
    where: { parent_id: deptId },
    attributes: ['id']
  });
  for (const child of children) {
    const childIds = await getDepartmentAndDescendantIds(child.id);
    ids.push(...childIds);
  }
  return ids;
};

// GET /api/employees - 获取员工列表（分页、搜索）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, department, departmentId, level } = req.query;
    const offset = (page - 1) * pageSize;

    const where = { is_active: true };

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (departmentId) {
      // 包含子部门：查询该部门及所有后代部门的员工
      const deptIds = await getDepartmentAndDescendantIds(parseInt(departmentId));
      where.department_id = { [Op.in]: deptIds };
    }
    if (level) {
      where.level = level;
    }
    if (department) {
      where.department = department;
    }

    const { count, rows } = await Employee.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(pageSize),
      order: [['created_at', 'DESC']],
      include: [{
        model: Template,
        as: 'default_template',
        attributes: ['id', 'name']
      }]
    });

    // 简化返回数据
    const list = rows.map(emp => ({
      id: emp.id,
      name: emp.name,
      gender: emp.gender,
      birthday: emp.birthday,
      phone: emp.phone,
      department: emp.department,
      department_id: emp.department_id,
      department_code: emp.department_code,
      level: emp.level,
      position: emp.position,
      default_template_id: emp.default_template_id || null,
      defaultTemplateName: emp.default_template?.name || null
    }));

    success(res, {
      list,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/employees/today-birthday - 获取今天生日的员工（必须在 /:id 之前定义）
router.get('/today-birthday', async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const employees = await Employee.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          sequelize.where(sequelize.fn('MONTH', sequelize.col('birthday')), month),
          sequelize.where(sequelize.fn('DAY', sequelize.col('birthday')), day)
        ]
      },
      include: [{
        model: Template,
        as: 'default_template',
        attributes: ['id', 'name']
      }]
    });

    success(res, employees);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/employees/:id - 获取单个员工详情
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{
        model: Template,
        as: 'default_template'
      }]
    });

    if (!employee) {
      return error(res, '员工不存在', 404);
    }

    success(res, employee);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees - 新增员工（自动匹配通用模板）
router.post('/', async (req, res) => {
  try {
    const employee = await Employee.create(sanitizeEmployeeInput(req.body));
    // 若未手动指定模板，自动从通用模板中随机匹配
    await autoAssignTemplateToEmployee(employee);
    // 记录操作日志
    logOperation({ ...extractLogInfo(req), action: 'create', model: 'Employee', model_id: employee.id, details: { name: employee.name } });
    success(res, employee, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees/backfill-templates - 回填：为所有未匹配模板的员工随机分配通用模板
router.post('/backfill-templates', async (req, res) => {
  try {
    const unmatched = await Employee.findAll({
      where: { default_template_id: null, is_active: true }
    });

    if (unmatched.length === 0) {
      return success(res, { updated: 0 }, '所有员工均已匹配模板');
    }

    let updated = 0;
    for (const emp of unmatched) {
      const template = await pickRandomUniversalTemplate();
      if (template) {
        await emp.update({ default_template_id: template.id });
        updated++;
      }
    }

    success(res, { updated }, `已为 ${updated} 位员工补配模板`);
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/employees/:id - 修改员工
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Employee.update(
      sanitizeEmployeeInput(req.body),
      { where: { id: req.params.id } }
    );

    if (!updated) {
      return error(res, '员工不存在', 404);
    }

    logOperation({ ...extractLogInfo(req), action: 'update', model: 'Employee', model_id: parseInt(req.params.id), details: sanitizeEmployeeInput(req.body) });
    success(res, null, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/employees/:id - 删除员工（硬删除，级联清除发送记录和贺卡文件）
router.delete('/:id', async (req, res) => {
  try {
    const emp = await Employee.findByPk(req.params.id);
    if (!emp) {
      return error(res, '员工不存在', 404);
    }

    // 清理磁盘上的贺卡 HTML 文件
    const records = await SendRecord.findAll({ where: { employee_id: req.params.id }, attributes: ['card_id'] });
    for (const record of records) {
      if (record.card_id) {
        const filePath = path.join(config.cardsDir, `${record.card_id}.html`);
        await fs.unlink(filePath).catch(() => {});
      }
    }

    // 级联删除发送记录
    await SendRecord.destroy({ where: { employee_id: req.params.id } });

    await Employee.destroy({ where: { id: req.params.id } });
    logOperation({ ...extractLogInfo(req), action: 'delete', model: 'Employee', model_id: parseInt(req.params.id), details: { name: emp.name } });
    success(res, null, '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees/:id/generate-card - 手动生成员工贺卡并发送短信
router.post('/:id/generate-card', async (req, res) => {
  try {
    const result = await sendBirthdayCard({ employeeId: req.params.id, adminId: req.user.id });

    if (!result.employee) {
      return error(res, result.error, 404);
    }
    if (!result.template) {
      return error(res, result.error, 400);
    }

    success(res, {
      cardUrl: result.cardUrl,
      cardId: result.cardId,
      messageId: result.messageId,
      smsStatus: result.smsStatus,
      smsProvider: result.smsProvider,
      smsContent: result.smsContent,
      employeeName: result.employeeName,
      templateName: result.templateName,
      smsError: result.error
    }, result.success ? '贺卡生成并发送成功' : '贺卡生成成功，短信发送失败');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees/import - Excel批量导入
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传Excel文件', 400);
    }

    console.log(`[导入] 文件: ${req.file.originalname}, 路径: ${req.file.path}, 大小: ${req.file.size} bytes`);
    const employees = parseEmployeeExcel(req.file.path, req.file.originalname);
    const errors = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const validationErrors = validateEmployee(emp);
      
      if (validationErrors.length > 0) {
        errors.push({ row: i + 2, reason: validationErrors.join('; ') });
      }
    }

    if (errors.length > 0) {
      await fs.unlink(req.file.path);
      return error(res, `部分数据验证失败`, 400, {
        total: employees.length,
        valid: employees.length - errors.length,
        errors
      });
    }

    // 检查重复手机号（手动检查，因为 phone 字段无唯一索引）
    const duplicates = [];
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const existing = await Employee.findOne({ where: { phone: emp.phone } });
      if (existing) {
        duplicates.push({ row: i + 2, phone: emp.phone, name: emp.name });
      }
    }

    if (duplicates.length > 0) {
      await fs.unlink(req.file.path);
      return error(res, `发现重复手机号`, 400, {
        total: employees.length,
        duplicates
      });
    }

    // 批量插入（已手动检查重复，移除 ignoreDuplicates）
    const result = await Employee.bulkCreate(
      employees,
      { validate: true }
    );

    // 自动为未指定模板的新员工随机分配通用模板
    let autoMatched = 0;
    for (const emp of result) {
      if (!emp.default_template_id) {
        const template = await pickRandomUniversalTemplate();
        if (template) {
          await emp.update({ default_template_id: template.id });
          autoMatched++;
        }
      }
    }
    if (autoMatched > 0) {
      console.log(`[导入] 已为 ${autoMatched} 位新员工自动匹配通用模板`);
    }

    // 删除临时文件
    await fs.unlink(req.file.path);

    success(res, {
      total: employees.length,
      imported: result.length
    }, `成功导入 ${result.length} 条数据`);
  } catch (err) {
    // 出错也删除临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch {}
    }
    error(res, `导入失败: ${err.message}`);
  }
});

export default router;
