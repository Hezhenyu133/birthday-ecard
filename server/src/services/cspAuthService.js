// CSP北向接口鉴权服务
// 实现双层SHA256+Base64认证算法，严格遵循V2.4.3规范
// 算法：Basic BASE64(appid:sha256(sha256(password) + GMT_Date))

import crypto from 'crypto';

/**
 * SHA256加密
 * @param {string} content - 待加密内容
 * @returns {string} 小写十六进制哈希值
 */
const sha256 = (content) => {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

/**
 * 生成CSP接口鉴权头
 * 
 * 步骤：
 * 1. 生成标准GMT时间（UTC零时区）
 * 2. SHA256(password) → pwdSha256
 * 3. SHA256(pwdSha256 + GMT_Date) → finalSha256
 * 4. Base64(appid + ":" + finalSha256) → authorization
 * 
 * @param {string} appid - Chatbot应用ID
 * @param {string} password - Chatbot应用密钥
 * @returns {{ authorization: string, date: string }}
 */
export const generateCspAuth = (appid, password) => {
  // 1. 生成标准GMT时间
  const date = new Date().toUTCString();
  // toUTCString() 输出: "Tue, 08 Jul 2026 08:00:00 GMT"

  // 2. 密码SHA256加密
  const pwdSha256 = sha256(password);

  // 3. 二次加密：密文 + GMT时间
  const finalSha256 = sha256(pwdSha256 + date);

  // 4. Base64编码
  const authValue = Buffer.from(`${appid}:${finalSha256}`).toString('base64');

  return {
    authorization: `Basic ${authValue}`,
    date
  };
};
