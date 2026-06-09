import { Router } from 'express';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { Blessing, Template } from '../models/index.js';

const router = Router();

router.use(authMiddleware);

const BLESSING_FIELDS = [
  'content',
  'match_gender',
  'match_age_min',
  'match_age_max',
  'is_active'
];

const sanitizeInput = (obj) => {
  const sanitized = {};
  for (const key of BLESSING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// GET /api/blessings - 祝福语列表
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === '1' || req.query.is_active === 'true';
    }
    const blessings = await Blessing.findAll({ where, order: [['created_at', 'DESC']] });

    // 为每条祝福语查询引用它的模板数量
    const blessingsWithCount = await Promise.all(
      blessings.map(async (blessing) => {
        const templateCount = await Template.count({
          where: { default_blessing_id: blessing.id }
        });
        return {
          ...blessing.toJSON(),
          template_count: templateCount
        };
      })
    );

    success(res, blessingsWithCount);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/blessings/:id - 祝福语详情
router.get('/:id', async (req, res) => {
  try {
    const blessing = await Blessing.findByPk(req.params.id);
    if (!blessing) {
      return error(res, '祝福语不存在', 404);
    }
    success(res, blessing);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/blessings - 新增祝福语
router.post('/', async (req, res) => {
  try {
    const blessing = await Blessing.create(sanitizeInput(req.body));
    success(res, blessing, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/blessings/:id - 修改祝福语
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Blessing.update(
      sanitizeInput(req.body),
      { where: { id: req.params.id } }
    );
    if (!updated) {
      return error(res, '祝福语不存在', 404);
    }
    success(res, null, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/blessings/:id - 删除祝福语
router.delete('/:id', async (req, res) => {
  try {
    // 检查是否有模板引用此祝福语
    const refCount = await Template.count({ where: { default_blessing_id: req.params.id } });
    if (refCount > 0) {
      // 解除模板关联
      await Template.update({ default_blessing_id: null }, { where: { default_blessing_id: req.params.id } });
      console.log(`[祝福语] 已解除 ${refCount} 个模板的默认祝福语关联`);
    }

    const deleted = await Blessing.destroy({ where: { id: req.params.id } });
    if (!deleted) {
      return error(res, '祝福语不存在', 404);
    }
    success(res, null, refCount > 0 ? `删除成功，已解除 ${refCount} 个模板的关联` : '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;
