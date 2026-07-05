import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { Template, Blessing, Employee, SendRecord } from '../models/index.js';
import { autoAssignBlessingToTemplate, pickRandomUniversalBlessing } from '../services/autoMatch.js';
import { logOperation, extractLogInfo } from '../middlewares/operationLog.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 所有模板路由需要认证
router.use(authMiddleware);

/**
 * 白名单过滤：防止mass assignment攻击
 * 只允许更新模型的合法字段
 */
const TEMPLATE_FIELDS = [
  'name', 'description', 'match_gender',
  'match_age_min', 'match_age_max', 'match_interests',
  'html_content', 'default_blessing_id', 'preview_image', 'is_active',
  'employee_level', 'page_count', 'template_type'
];

const sanitizeInput = (obj) => {
  const sanitized = {};
  for (const key of TEMPLATE_FIELDS) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// GET /api/templates - 获取模板列表（不返回html_content）
router.get('/', async (req, res) => {
  try {
    const templates = await Template.findAll({
      attributes: ['id', 'name', 'description', 'match_gender', 'match_age_min', 'match_age_max', 'default_blessing_id', 'is_active', 'created_at'],
      include: [{
        model: Blessing,
        as: 'default_blessing',
        attributes: ['id', 'content']
      }]
    });
    success(res, templates);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/templates/:id - 获取模板详情（包含html_content）
router.get('/:id', async (req, res) => {
  try {
        const template = await Template.findByPk(req.params.id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
    
    if (!template) {
      return error(res, '模板不存在', 404);
    }

    success(res, template);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/templates - 新增模板（自动匹配通用祝福语）
router.post('/', async (req, res) => {
  try {
    const template = await Template.create(sanitizeInput(req.body));
    // 若未手动指定祝福语，自动从通用祝福语中随机匹配
    await autoAssignBlessingToTemplate(template);
    // 重新查询以返回祝福语关联
    const result = await Template.findByPk(template.id, {
      include: [{ model: Blessing, as: 'default_blessing', attributes: ['id', 'content'] }]
    });
    logOperation({ ...extractLogInfo(req), action: 'create', model: 'Template', model_id: template.id, details: { name: template.name } });
    success(res, result, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/templates/backfill-blessings - 回填：为所有未匹配祝福语的模板随机分配通用祝福语
router.post('/backfill-blessings', async (req, res) => {
  try {
    const unmatched = await Template.findAll({
      where: { default_blessing_id: null, is_active: true }
    });

    if (unmatched.length === 0) {
      return success(res, { updated: 0 }, '所有模板均已匹配祝福语');
    }

    let updated = 0;
    for (const tpl of unmatched) {
      const blessing = await pickRandomUniversalBlessing();
      if (blessing) {
        await tpl.update({ default_blessing_id: blessing.id });
        updated++;
      }
    }

    success(res, { updated }, `已为 ${updated} 个模板补配祝福语`);
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/templates/:id - 修改模板
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Template.update(
      sanitizeInput(req.body),
      { where: { id: req.params.id } }
    );
    
    if (!updated) {
      return error(res, '模板不存在', 404);
    }

    logOperation({ ...extractLogInfo(req), action: 'update', model: 'Template', model_id: parseInt(req.params.id), details: sanitizeInput(req.body) });
    success(res, null, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/templates/:id - 删除模板
router.delete('/:id', async (req, res) => {
  try {
    // 检查是否有员工引用此模板
    const refCount = await Employee.count({ where: { default_template_id: req.params.id } });
    if (refCount > 0) {
      // 解除员工关联而不是阻止删除
      await Employee.update({ default_template_id: null }, { where: { default_template_id: req.params.id } });
      console.log(`[模板] 已解除 ${refCount} 位员工的默认模板关联`);
    }

    // 解除发送记录中的模板引用（保留 card_url 让贺卡仍可访问）
    const recordCount = await SendRecord.count({ where: { template_id: req.params.id } });
    if (recordCount > 0) {
      await SendRecord.update({ template_id: null }, { where: { template_id: req.params.id } });
      console.log(`[模板] 已解除 ${recordCount} 条发送记录的模板关联`);
    }

    // 查询模板名称用于操作日志
    const template = await Template.findByPk(req.params.id);

    const deleted = await Template.destroy({ where: { id: req.params.id } });
    
    if (!deleted) {
      return error(res, '模板不存在', 404);
    }

    logOperation({ ...extractLogInfo(req), action: 'delete', model: 'Template', model_id: parseInt(req.params.id), details: { name: template?.name } });
    success(res, null, refCount > 0 ? `删除成功，已解除 ${refCount} 位员工的关联` : '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/templates/:id/preview - 预览模板渲染效果
router.get('/:id/preview', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
    
    if (!template) {
      return error(res, '模板不存在', 404);
    }

    // 使用示例数据替换占位符
    let html = template.html_content;
    const now = new Date();
    const replacements = {
      '{{name}}': '张三',
      '{{department}}': '技术部',
      '{{position}}': '工程师',
      '{{birthday}}': '6月15日',
      '{{sender}}': '公司工会',
      '{{company}}': '公司工会',
      '{{logo_url}}': '',
      '{{blessing}}': template.default_blessing?.content || '祝你生日快乐，万事如意！',
      '{{title}}': '张三的生日贺卡',
      '{{year}}': now.getFullYear().toString(),
      '{{month}}': (now.getMonth() + 1).toString(),
      '{{day}}': now.getDate().toString()
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replaceAll(placeholder, value);
    }

    res.type('text/html').send(html);
  } catch (err) {
    error(res, err.message, 500);
  }
});

export default router;
