/**
 * 视频模板配置
 * 定义每个模板的录制参数
 */

export const VIDEO_TEMPLATE_CONFIGS = [
  {
    templateName: '温馨员工版',
    templateDir: 'birthday-card-13-employee-warm-image',
    screenOrder: ['cover', 'wish', 'highlight', 'final'],
    pageDuration: 3,
    totalDuration: 12,
    maxSizeMb: 2
  },
  {
    templateName: '夜景高管版',
    templateDir: 'birthday-card-14-executive-night-image',
    screenOrder: ['cover', 'wish', 'highlight', 'final'],
    pageDuration: 3,
    totalDuration: 12,
    maxSizeMb: 2
  },
  {
    templateName: '私宴高管版',
    templateDir: 'birthday-card-15-executive-private-banquet',
    screenOrder: ['cover', 'identity', 'message', 'honor', 'reflection', 'signoff', 'final'],
    pageDuration: 3.7,
    totalDuration: 26,
    maxSizeMb: 2
  },
  {
    templateName: '荣誉画廊高管版',
    templateDir: 'birthday-card-16-executive-honor-gallery',
    screenOrder: ['cover', 'identity', 'message', 'honor', 'reflection', 'signoff', 'final'],
    pageDuration: 3.7,
    totalDuration: 26,
    maxSizeMb: 2
  },
  {
    templateName: '时光档案高管版',
    templateDir: 'birthday-card-17-executive-time-archive',
    screenOrder: ['cover', 'name', 'imprint', 'compass', 'wish', 'message', 'final'],
    pageDuration: 3.7,
    totalDuration: 26,
    maxSizeMb: 2
  }
];

/**
 * 根据模板名称获取视频录制配置
 * @param {string} templateName - 模板名称
 * @returns {object|null} 视频配置对象，未找到返回 null
 */
export const getVideoConfig = (templateName) => {
  return VIDEO_TEMPLATE_CONFIGS.find(c => c.templateName === templateName) || null;
};
