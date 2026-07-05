import { Router } from 'express';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { Department, Employee } from '../models/index.js';
import { logOperation, extractLogInfo } from '../middlewares/operationLog.js';

const router = Router();

router.use(authMiddleware);

const DEPARTMENT_FIELDS = [
  'name',
  'code',
  'level',
  'parent_id',
  'sort_order',
  'description',
  'is_active'
];

const sanitizeInput = (obj) => {
  const sanitized = {};
  for (const key of DEPARTMENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// 递归构建部门树
const buildTree = (departments, parentId = null) => {
  return departments
    .filter(d => d.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(d => ({
      ...d.toJSON(),
      children: buildTree(departments, d.id)
    }));
};

// GET /api/departments/tree - 获取部门树形结构
router.get('/tree', async (req, res) => {
  try {
    const where = {};
    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === '1' || req.query.is_active === 'true';
    }
    const departments = await Department.findAll({ where, order: [['sort_order', 'ASC']] });
    const tree = buildTree(departments);
    success(res, tree);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/departments - 获取部门平铺列表
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === '1' || req.query.is_active === 'true';
    }
    const departments = await Department.findAll({
      where,
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    success(res, departments);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/departments/:id - 获取部门详情
router.get('/:id', async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id, {
      include: [{ model: Employee, as: 'employees', attributes: ['id', 'name'] }]
    });
    if (!department) {
      return error(res, '部门不存在', 404);
    }
    success(res, department);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/departments - 新增部门
router.post('/', async (req, res) => {
  try {
    const data = sanitizeInput(req.body);

    // 验证必填字段
    if (!data.name || !data.code) {
      return error(res, '部门名称和编码为必填项', 400);
    }

    // 验证编码唯一性
    const existing = await Department.findOne({ where: { code: data.code } });
    if (existing) {
      return error(res, `部门编码 "${data.code}" 已存在`, 400);
    }

    // 如果有父部门，验证父部门存在并自动计算 level
    if (data.parent_id) {
      const parent = await Department.findByPk(data.parent_id);
      if (!parent) {
        return error(res, '父部门不存在', 400);
      }
      data.level = parent.level + 1;
    } else {
      data.level = data.level || 1;
    }

    const department = await Department.create(data);
    logOperation({ ...extractLogInfo(req), action: 'create', model: 'Department', model_id: department.id, details: { name: department.name } });
    success(res, department, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/departments/:id - 修改部门
router.put('/:id', async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      return error(res, '部门不存在', 404);
    }

    const data = sanitizeInput(req.body);

    // 如果修改了编码，验证唯一性
    if (data.code && data.code !== department.code) {
      const existing = await Department.findOne({ where: { code: data.code } });
      if (existing) {
        return error(res, `部门编码 "${data.code}" 已存在`, 400);
      }
    }

    // 如果修改了父部门，重新计算 level
    if (data.parent_id !== undefined && data.parent_id !== department.parent_id) {
      if (data.parent_id === department.id) {
        return error(res, '不能将部门设为自己的子部门', 400);
      }
      if (data.parent_id) {
        const parent = await Department.findByPk(data.parent_id);
        if (!parent) {
          return error(res, '父部门不存在', 400);
        }
        data.level = parent.level + 1;
      }
    }

    await department.update(data);
    logOperation({ ...extractLogInfo(req), action: 'update', model: 'Department', model_id: parseInt(req.params.id) });
    success(res, department, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/departments/:id - 删除部门
router.delete('/:id', async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      return error(res, '部门不存在', 404);
    }

    // 检查是否有子部门
    const childCount = await Department.count({ where: { parent_id: department.id } });
    if (childCount > 0) {
      return error(res, `该部门下有 ${childCount} 个子部门，请先删除或移动子部门`, 400);
    }

    // 检查是否有员工
    const employeeCount = await Employee.count({ where: { department_id: department.id } });
    if (employeeCount > 0) {
      return error(res, `该部门下有 ${employeeCount} 名员工，不能删除`, 400);
    }

    await department.destroy();
    logOperation({ ...extractLogInfo(req), action: 'delete', model: 'Department', model_id: parseInt(req.params.id), details: { name: department.name } });
    success(res, null, '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;
