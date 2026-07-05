// config/index.js 由 app.js 统一加载 dotenv，此文件不再重复调用

const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_in_production';
const nodeEnv = process.env.NODE_ENV || 'development';
const smsProvider = process.env.SMS_PROVIDER || 'mock';

// 生产环境安全警告
if (nodeEnv === 'production' && jwtSecret === 'default_secret_change_in_production') {
  console.error('[安全警告] JWT_SECRET 使用默认值！生产环境必须设置强密钥！');
  console.error('[安全警告] 请在 .env 文件中设置 JWT_SECRET 为一个至少32字符的随机字符串');
}

if (smsProvider === 'carrier' && !process.env.SMS_API_KEY) {
  console.warn('[短信警告] SMS_PROVIDER=carrier 但 SMS_API_KEY 未配置，发送将失败！');
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  cardsDir: process.env.CARDS_DIR || './generated-cards',
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  // 贺卡发送者名称（用于模板 {{sender}} 占位符）
  senderName: process.env.SENDER_NAME || '公司工会',
  // 公司名称（用于模板 {{company}} 占位符，默认与 senderName 相同）
  companyName: process.env.COMPANY_NAME || process.env.SENDER_NAME || '公司工会',
  // 公司 Logo URL（用于模板 {{logo_url}} 占位符）
  logoUrl: process.env.LOGO_URL || '',
  // 短信发送配置
  sms: {
    provider: smsProvider,
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || '',
    senderId: process.env.SMS_SENDER_ID || '',
    maxRetries: parseInt(process.env.SMS_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.SMS_RETRY_DELAY) || 1000,
    timeout: parseInt(process.env.SMS_TIMEOUT) || 10000
  },
  // 操作日志保留天数（默认 60 天）
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 60,
  // 会话超时时间（分钟，默认 30 分钟）
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30,
  // 最大并发会话数（默认 3）
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3
};
