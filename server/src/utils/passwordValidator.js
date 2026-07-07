/**
 * 密码复杂度验证工具
 * 要求：6位以上，包含字母和数字
 */

/**
 * 验证密码复杂度
 * @param {string} password - 待验证的密码
 * @returns {{ valid: boolean, message: string }}
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: '密码不能为空' };
  }

  if (password.length < 6) {
    return { valid: false, message: '密码长度不能少于6位' };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个字母' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }

  return { valid: true, message: '密码符合要求' };
};
