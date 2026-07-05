// 贺卡生成服务
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

/**
 * 格式化生日为中文日期字符串
 * 将 "1990-06-15" 格式的日期转为 "6月15日"
 * @param {string} dateStr - DATEONLY 格式日期字符串 (YYYY-MM-DD)
 * @returns {string} 中文格式的月日
 */
const formatBirthday = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch {
    return dateStr; // 解析失败时返回原始字符串
  }
};

/**
 * 根据模板和员工信息生成个性化贺卡
 */
export const generateCard = async (template, employee) => {
  try {
    // 读取模板HTML内容
    let html = template.html_content;
    
    // 生成祝福语（简化版本，实际可更复杂）
    const blessing = template.default_blessing?.content || [
      `生日快乐！愿你永远开心如意！`,
      `祝你生日快乐，身体健康，工作顺利！`,
      `愿你的每一天都充满阳光和欢笑！`,
      `生日快乐！愿你心想事成，万事如意！`
    ][Math.floor(Math.random() * 4)];

    // 当前日期信息
    const now = new Date();

    // 条件性生成部门/职位行：空值时不显示
    const dept = employee.department || '';
    const pos = employee.position || '';
    let deptBlock = '';
    if (dept || pos) {
      const deptText = dept && pos ? `${dept} · ${pos}` : dept || pos;
      deptBlock = `<div class="info-dept anim-item anim-d3">${deptText}</div>`;
    }

    // 替换占位符
    const senderName = config.senderName || '公司工会';
    const companyName = config.companyName || senderName;
    const logoUrl = config.logoUrl || '';
    const replacements = {
      '{{name}}': employee.name,
      '{{deptBlock}}': deptBlock,
      '{{department}}': dept,
      '{{position}}': pos,
      '{{birthday}}': formatBirthday(employee.birthday),
      '{{sender}}': senderName,
      '{{company}}': companyName,
      '{{logo_url}}': logoUrl,
      '{{blessing}}': blessing,
      '{{title}}': `${employee.name}的生日贺卡`,
      '{{year}}': now.getFullYear().toString(),
      '{{month}}': (now.getMonth() + 1).toString(),
      '{{day}}': now.getDate().toString()
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replaceAll(placeholder, value);
    }

    // 后处理：移除仅含分隔符“·”的空部门/职位行（兼容未使用 deptBlock 占位符的模板）
    html = html.replace(/<div\s[^>]*>\s*·\s*<\/div>/g, '');

    // 生成唯一ID
    const cardId = uuidv4();
    
    // 保存HTML文件
    const filePath = path.join(config.cardsDir, `${cardId}.html`);
    await fs.writeFile(filePath, html, 'utf-8');
    
    return {
      cardId,
      cardUrl: `${config.baseUrl}/card/${cardId}`
    };
  } catch (error) {
    console.error('贺卡生成失败:', error);
    throw error;
  }
};
