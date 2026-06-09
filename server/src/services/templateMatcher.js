// 模板匹配服务
import { Template, Blessing } from '../models/index.js';

/**
 * 根据员工信息匹配最佳模板
 * 匹配优先级：手动指定 > 性别+年龄 > 性别 > 通用模板
 */
export const matchTemplate = async (employee) => {
  // 1. 如果员工有手动指定的模板，直接使用
  if (employee.default_template_id) {
    return await Template.findByPk(employee.default_template_id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
  }

  // 2. 计算员工年龄
  const birthDate = new Date(employee.birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // 3. 查找匹配的模板（按优先级排序：具体性别 > 通用）
  const templates = await Template.findAll({ 
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  // 按性别匹配度排序：具体性别优先于 'all'
  const sortedTemplates = templates.sort((a, b) => {
    const aMatch = a.match_gender === employee.gender ? 0 : (a.match_gender === 'all' ? 1 : 2);
    const bMatch = b.match_gender === employee.gender ? 0 : (b.match_gender === 'all' ? 1 : 2);
    return aMatch - bMatch;
  });

  // 精确匹配：性别 + 年龄段
  const exactMatch = sortedTemplates.find(t =>
    (t.match_gender === employee.gender || t.match_gender === 'all') &&
    (!t.match_age_min || age >= t.match_age_min) &&
    (!t.match_age_max || age <= t.match_age_max)
  );
  if (exactMatch) return exactMatch;

  // 宽松匹配：仅性别
  const genderMatch = sortedTemplates.find(t =>
    t.match_gender === employee.gender || t.match_gender === 'all'
  );
  if (genderMatch) return genderMatch;

  // 兜底：返回第一个启用的通用模板
  return sortedTemplates.find(t => t.match_gender === 'all') || sortedTemplates[0];
};