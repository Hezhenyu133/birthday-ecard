// 短信/彩信/5G视信发送服务
// 支持三种模式：mock（模拟发送）、carrier（通用运营商API）、csp（5G视信CSP V2.4.3）
// 切换发送模式只需修改 .env 中的 SMS_PROVIDER

import axios from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { generateCspAuth } from './cspAuthService.js';
import { buildOutboundXml, buildOutboundXmlLarge } from './cspXmlBuilder.js';
import { extractMessageIdFromXml, extractErrorCodeFromXml, extractErrorMsgFromXml } from '../utils/cspXmlParser.js';

/**
 * 发送短信/彩信/5G视信（主入口函数）
 * 
 * 根据 SMS_PROVIDER 配置自动选择发送模式，内置重试机制。
 * 该函数永远不会抛出异常，所有错误都通过返回值中的 success/error 字段体现。
 */
export const sendSMS = async (phone, cardUrl, employeeName, options = {}) => {
  const { videoPath = null } = options;
  const provider = config.sms.provider;
  const sentAt = new Date();

  try {
    if (provider === 'carrier') {
      return await _sendWithRetry(() => _carrierSend(phone, cardUrl, employeeName, { videoPath }));
    } else if (provider === 'csp') {
      return await _sendWithRetry(() => _cspSend(phone, cardUrl, employeeName, { videoPath }));
    } else {
      return await _mockSend(phone, cardUrl, employeeName, { videoPath });
    }
  } catch (error) {
    return {
      success: false,
      messageId: null,
      provider,
      retryCount: 0,
      error: `未预期的错误: ${error.message}`,
      sentAt
    };
  }
};

/**
 * 模拟短信/彩信发送 - 仅在控制台输出日志，不实际发送
 */
const _mockSend = async (phone, cardUrl, employeeName, options = {}) => {
  const { videoPath = null } = options;
  await new Promise(resolve => setTimeout(resolve, 100));

  const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sendType = videoPath ? 'MMS' : 'SMS';
  
  console.log(`[短信模拟] 类型: ${sendType}`);
  console.log(`[短信模拟] 收件人: ${phone}`);
  console.log(`[短信模拟] 员工: ${employeeName}`);
  console.log(`[短信模拟] 贺卡链接: ${cardUrl}`);
  if (videoPath) {
    console.log(`[短信模拟] 视频附件: ${videoPath}`);
  }
  console.log(`[短信模拟] 消息ID: ${messageId}`);

  return {
    success: true,
    messageId,
    provider: 'mock',
    retryCount: 0,
    error: null,
    sentAt: new Date(),
    contributionId: null
  };
};

/**
 * 通过通用运营商API发送短信/彩信
 */
const _carrierSend = async (phone, cardUrl, employeeName, options = {}) => {
  const { videoPath = null } = options;
  const { apiUrl, apiKey, timeout } = config.sms;

  if (!apiUrl) {
    throw new Error('SMS_API_URL 未配置，无法调用运营商接口');
  }

  if (videoPath) {
    return await _sendMms(phone, cardUrl, employeeName, videoPath);
  } else {
    return await _sendSms(phone, cardUrl, employeeName);
  }
};

/**
 * 通过5G视信CSP接口发送视频短信
 * 遵循V2.4.3规范：双层SHA256鉴权 + XML请求体 + 模板化发送
 */
const _cspSend = async (phone, cardUrl, employeeName, options = {}) => {
  const { videoPath = null } = options;
  const { csp, timeout } = config.sms;

  // 1. 参数校验
  if (!csp.appid || !csp.password || !csp.chatbotURI) {
    throw new Error('CSP 配置不完整（CSP_APPID/CSP_PASSWORD/CSP_CHATBOT_URI）');
  }
  if (!csp.videoTemplateId) {
    throw new Error('CSP_VIDEO_TEMPLATE_ID 未配置，5G视信模板ID必填');
  }

  // 2. 视频大小检查（>5M不可发送）
  let videoSize = 0;
  if (videoPath) {
    const stat = await fs.promises.stat(videoPath).catch(() => ({ size: 0 }));
    videoSize = stat.size;
    if (videoSize > 5 * 1024 * 1024) {
      throw new Error(`视频文件过大(${(videoSize / 1024 / 1024).toFixed(1)}MB)，CSP规范上限5MB`);
    }
  }

  // 3. 生成鉴权头
  const { authorization, date } = generateCspAuth(csp.appid, csp.password);

  // 4. 构建XML请求体
  const contributionId = uuidv4();
  const xmlParams = {
    phone,
    videoTemplateId: csp.videoTemplateId,
    contributionId
  };

  const xmlBody = videoSize > 2 * 1024 * 1024
    ? buildOutboundXmlLarge(xmlParams)
    : buildOutboundXml(xmlParams);

  // 5. 拼接请求地址
  const endpoint = `${csp.serverRoot}/messaging/group/template/outbound/${encodeURIComponent(csp.chatbotURI)}/requests`;

  console.log(`[5G视信] 发送到: ${phone}, 模板ID: ${csp.videoTemplateId}, 视频大小: ${videoSize ? (videoSize / 1024 / 1024).toFixed(1) + 'MB' : '无'}, 会话ID: ${contributionId}`);

  // 6. 发送HTTPS POST请求
  const response = await axios.post(endpoint, xmlBody, {
    headers: {
      'Authorization': authorization,
      'Date': date,
      'Content-Type': 'application/xml;charset=UTF-8',
      'UserType': '10'
    },
    timeout,
    // 确保不抛出非2xx错误（手动处理）
    validateStatus: () => true
  });

  // 7. 解析响应
  return _parseCspResponse(response, contributionId);
};

/**
 * 解析CSP接口响应
 */
const _parseCspResponse = (response, contributionId) => {
  const statusCode = response.status;
  const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

  if (statusCode === 201 || statusCode === 200) {
    const messageId = extractMessageIdFromXml(data) || contributionId;
    console.log(`[5G视信] 发送成功, 消息ID: ${messageId}`);

    return {
      success: true,
      messageId: String(messageId),
      provider: 'csp',
      retryCount: 0,
      error: null,
      sentAt: new Date(),
      contributionId,
      rawResponse: data
    };
  }

  // 错误处理
  const errorCode = extractErrorCodeFromXml(data) || String(statusCode);
  const errorMsg = extractErrorMsgFromXml(data);
  const err = new Error(`CSP错误[${errorCode}]: ${errorMsg}`);
  err.isRateLimit = errorCode === '31008';
  throw err;
};

/**
 * 发送普通短信（carrier模式）
 */
const _sendSms = async (phone, cardUrl, employeeName) => {
  const { apiUrl, apiKey, timeout } = config.sms;
  const messageContent = `亲爱的${employeeName}，祝您生日快乐！点击查看您的专属贺卡：${cardUrl}`;

  const response = await axios.post(`${apiUrl}/api/v1/send_sms`, {
    to: phone,
    msg: messageContent
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    timeout
  });

  const data = response.data;
  const isSuccess = data.code === 0 || data.code === '0' || data.status === 'success';
  
  if (!isSuccess) {
    throw new Error(`运营商返回错误: ${data.message || JSON.stringify(data)}`);
  }

  const messageId = data.message_id || data.msgId || data.id || null;

  return {
    success: true,
    messageId: String(messageId),
    provider: 'carrier',
    retryCount: 0,
    error: null,
    sentAt: new Date(),
    contributionId: null,
    rawResponse: data
  };
};

/**
 * 发送彩信（carrier模式，含视频附件）
 */
const _sendMms = async (phone, cardUrl, employeeName, videoPath) => {
  const { apiUrl, apiKey, timeout } = config.sms;
  const FormData = (await import('form-data')).default;
  const formData = new FormData();

  const messageContent = `亲爱的${employeeName}，祝您生日快乐！请查看您的专属生日视频贺卡：${cardUrl}`;

  formData.append('to', phone);
  formData.append('content', messageContent);
  formData.append('attachment', fs.createReadStream(videoPath), {
    filename: 'birthday-card.mp4',
    contentType: 'video/mp4'
  });

  const response = await axios.post(`${apiUrl}/api/v1/send_mms`, formData, {
    headers: {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${apiKey}`
    },
    timeout: timeout * 3,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024
  });

  const data = response.data;
  const isSuccess = data.code === 0 || data.code === '0' || data.status === 'success';
  
  if (!isSuccess) {
    throw new Error(`运营商返回错误: ${data.message || JSON.stringify(data)}`);
  }

  const messageId = data.message_id || data.msgId || data.id || null;

  return {
    success: true,
    messageId: String(messageId),
    provider: 'carrier',
    retryCount: 0,
    error: null,
    sentAt: new Date(),
    contributionId: null,
    rawResponse: data
  };
};

/**
 * 带指数退避的重试包装器
 * 限流错误(31008)使用更长退避时间
 */
const _sendWithRetry = async (sendFn) => {
  const { maxRetries, retryDelay } = config.sms;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFn();
      result.retryCount = attempt;
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // 限流错误使用更长退避（10s * 2^attempt）
        const baseDelay = error.isRateLimit ? 10000 : retryDelay;
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[短信重试] 第 ${attempt + 1}/${maxRetries} 次重试，等待 ${delay}ms，原因: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[短信发送失败] 已重试 ${maxRetries} 次仍然失败: ${lastError.message}`);
  
  return {
    success: false,
    messageId: null,
    provider: config.sms.provider,
    retryCount: maxRetries,
    error: lastError.message,
    sentAt: new Date()
  };
};
