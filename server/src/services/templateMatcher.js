// 模板匹配服务
import { Op } from 'sequelize';
import { Template, Blessing } from '../models/index.js';

/**
 * 根据员工级别确定目标模板页数
 * 管理层(management)和经理(manager) → 7页模板
 * 普通员工(employee) → 4页模板
 * 无级别信息 → 不限页数
 */
const getTargetPageCount = (employeeLevel) => {
  if (employeeLevel === 'management' || employeeLevel === 'manager') return 7;
  if (employeeLevel === 'employee') return 4;
  return null; // 无级别或未知级别，不限制页数
};

/**
 * 判断模板的 employee_level 是否匹配员工的 level
 * employee_level 现在是数组（如 ['management', 'manager']）
 * 包含 'all' 或 null 时匹配所有等级
 */
const matchLevel = (template, employeeLevel) => {
  if (!employeeLevel) return true;
  const levels = template.employee_level; // getter 返回数组
  if (!levels || levels.includes('all')) return true;
  return levels.includes(employeeLevel);
};

/**
 * 根据员工信息匹配最佳模板
 * 匹配优先级：
 *   1. 手动指定 default_template_id
 *   2. 按员工级别筛选页数（管理层/经理→7页，普通员工→4页）
 *   3. 等级 + 性别 + 年龄 精确匹配
 *   4. 等级 + 性别 匹配
 *   5. 等级 匹配
 *   6. 性别 + 年龄（兜底）
 *   7. 仅性别（兜底）
 *   8. 通用模板兜底
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

  // 2. 计算员工年龄
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

  // 3. 获取模板列表
  const allTemplates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  // 4. 按员工级别筛选目标页数的模板
  const targetPages = getTargetPageCount(employee.level);
  const templates = targetPages
    ? allTemplates.filter(t => t.page_count === targetPages)
    : allTemplates;

  // 如果按页数筛选后没有可用模板，回退到全部模板
  const candidateTemplates = templates.length > 0 ? templates : allTemplates;

  if (templates.length === 0 && targetPages) {
    console.warn(`[模板匹配] 无 ${targetPages} 页模板可用，已回退到全部模板`);
  }

  const genderMatch = (t) => t.match_gender === employee.gender || t.match_gender === 'all';
  const levelMatch = (t) => matchLevel(t, employee.level);
  const ageMatch = (t) => (!t.match_age_min || age >= t.match_age_min) && (!t.match_age_max || age <= t.match_age_max);

  // 按性别匹配度排序：具体性别优先于 'all'
  const sortedTemplates = [...candidateTemplates].sort((a, b) => {
    const aMatch = a.match_gender === employee.gender ? 0 : (a.match_gender === 'all' ? 1 : 2);
    const bMatch = b.match_gender === employee.gender ? 0 : (b.match_gender === 'all' ? 1 : 2);
    return aMatch - bMatch;
  });

  // === 等级感知匹配 ===

  // 等级 + 性别 + 年龄 精确匹配
  if (age !== null && employee.level) {
    const exactMatch = sortedTemplates.find(t => levelMatch(t) && genderMatch(t) && ageMatch(t));
    if (exactMatch) return exactMatch;
  }

  // 等级 + 性别 匹配
  if (employee.level) {
    const levelGenderMatch = sortedTemplates.find(t => levelMatch(t) && genderMatch(t));
    if (levelGenderMatch) return levelGenderMatch;
  }

  // 仅等级匹配
  if (employee.level) {
    const levelOnlyMatch = sortedTemplates.find(t => levelMatch(t));
    if (levelOnlyMatch) return levelOnlyMatch;
  }

  // === 兜底逻辑 ===

  // 性别 + 年龄
  if (age !== null) {
    const exactMatch = sortedTemplates.find(t => genderMatch(t) && ageMatch(t));
    if (exactMatch) return exactMatch;
  }

  // 仅性别
  const genderOnlyMatch = sortedTemplates.find(t => genderMatch(t));
  if (genderOnlyMatch) return genderOnlyMatch;

  // 最终兜底
  return sortedTemplates.find(t => t.match_gender === 'all') || sortedTemplates[0];
};