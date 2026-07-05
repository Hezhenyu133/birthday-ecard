/**
 * 密码复杂度验证工具
 * 要求：8-20 字符，包含大写字母、小写字母、数字、特殊字符
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

  if (password.length < 8) {
    return { valid: false, message: '密码长度不能少于8位' };
  }

  if (password.length > 20) {
    return { valid: false, message: '密码长度不能超过20位' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个大写字母' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个小写字母' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个特殊字符' };
  }

  return { valid: true, message: '密码符合要求' };
};
