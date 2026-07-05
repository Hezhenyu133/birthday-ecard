// 模板匹配服务
import { Op } from 'sequelize';
import { Template, Blessing } from '../models/index.js';

/**
 * 判断模板的 employee_level 是否匹配员工的 level
 * 向后兼容：模板 employee_level 为 null 或 'all' 时匹配所有等级
 */
const matchLevel = (template, employeeLevel) => {
  if (!employeeLevel) return true; // 员工无等级时，所有模板都算匹配
  if (!template.employee_level || template.employee_level === 'all') return true;
  return template.employee_level === employeeLevel;
};

/**
 * 根据员工信息匹配最佳模板
 * 匹配优先级：
 *   1. 手动指定 default_template_id
 *   2. 等级 + 性别 + 年龄 精确匹配
 *   3. 等级 + 性别 匹配
 *   4. 等级 匹配
 *   5. 性别 + 年龄（原有逻辑保留）
 *   6. 仅性别（原有逻辑保留）
 *   7. 通用模板兜底
 *
 * @param {object} employee - 员工对象
 * @param {object[]|null} [preloadedTemplates] - 预加载的模板列表（避免 N+1 查询）
 */
export const matchTemplate = async (employee, preloadedTemplates = null) => {
  // 1. 如果员工有手动指定的模板，直接使用
  if (employee.default_template_id) {
    if (preloadedTemplates) {
      const found = preloadedTemplates.find(t => t.id === employee.default_template_id);
      if (found) return found;
    }
    return await Template.findByPk(employee.default_template_id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
  }

  // 2. 计算员工年龄（安全处理 birthday 为空的情况）
  let age = null;
  if (employee.birthday) {
    const birthDate = new Date(employee.birthday);
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
  }
  if (age === null) {
    console.warn(`[模板匹配] 员工 ${employee.name}（ID:${employee.id}）的 birthday 为空或无效，跳过年龄匹配`);
  }

  // 3. 获取模板列表（优先使用预加载数据，避免 N+1 查询）
  const templates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  const genderMatch = (t) => t.match_gender === employee.gender || t.match_gender === 'all';
  const levelMatch = (t) => matchLevel(t, employee.level);
  const ageMatch = (t) => (!t.match_age_min || age >= t.match_age_min) && (!t.match_age_max || age <= t.match_age_max);

  // 按性别匹配度排序：具体性别优先于 'all'
  const sortedTemplates = [...templates].sort((a, b) => {
    const aMatch = a.match_gender === employee.gender ? 0 : (a.match_gender === 'all' ? 1 : 2);
    const bMatch = b.match_gender === employee.gender ? 0 : (b.match_gender === 'all' ? 1 : 2);
    return aMatch - bMatch;
  });

  // === 新增：等级感知匹配 ===

  // 2. 等级 + 性别 + 年龄 精确匹配
  if (age !== null && employee.level) {
    const exactMatch = sortedTemplates.find(t => levelMatch(t) && genderMatch(t) && ageMatch(t));
    if (exactMatch) return exactMatch;
  }

  // 3. 等级 + 性别 匹配
  if (employee.level) {
    const levelGenderMatch = sortedTemplates.find(t => levelMatch(t) && genderMatch(t));
    if (levelGenderMatch) return levelGenderMatch;
  }

  // 4. 仅等级匹配
  if (employee.level) {
    const levelOnlyMatch = sortedTemplates.find(t => levelMatch(t));
    if (levelOnlyMatch) return levelOnlyMatch;
  }

  // === 原有逻辑保留（作为兜底） ===

  // 5. 精确匹配：性别 + 年龄段（仅在 age 有效时尝试）
  if (age !== null) {
    const exactMatch = sortedTemplates.find(t => genderMatch(t) && ageMatch(t));
    if (exactMatch) return exactMatch;
  }

  // 6. 宽松匹配：仅性别
  const genderOnlyMatch = sortedTemplates.find(t => genderMatch(t));
  if (genderOnlyMatch) return genderOnlyMatch;

  // 7. 兜底：返回第一个启用的通用模板
  return sortedTemplates.find(t => t.match_gender === 'all') || sortedTemplates[0];
};