// CSP XML响应/回调解析器
// 使用正则提取关键字段，避免引入XML解析库

/**
 * 从CSP发送接口的XML响应中提取消息ID
 * 成功响应中 resourceURL 包含消息标识
 * 
 * @param {string} xml - CSP接口返回的XML字符串
 * @returns {string|null} 消息ID
 */
export const extractMessageIdFromXml = (xml) => {
  if (!xml || typeof xml !== 'string') return null;

  // 尝试从 resourceURL 提取（格式：.../requests/{messageId}）
  const resourceMatch = xml.match(/<resourceURL[^>]*>([^<]+)<\/resourceURL>/);
  if (resourceMatch) {
    const parts = resourceMatch[1].split('/');
    return parts[parts.length - 1] || null;
  }

  // 尝试从 contributionID 提取
  const contribMatch = xml.match(/<contributionID[^>]*>([^<]+)<\/contributionID>/);
  if (contribMatch) {
    return contribMatch[1];
  }

  return null;
};

/**
 * 从CSP错误响应XML中提取错误码
 * 
 * @param {string} xml - CSP错误响应XML
 * @returns {string|null} 错误码（如 "31008"）
 */
export const extractErrorCodeFromXml = (xml) => {
  if (!xml || typeof xml !== 'string') return null;

  // requestStatus 中的 reason 包含错误码
  const reasonMatch = xml.match(/<reason[^>]*>([^<]+)<\/reason>/);
  if (reasonMatch) return reasonMatch[1];

  // statusText
  const statusMatch = xml.match(/<requestStatus[^>]*>([^<]+)<\/requestStatus>/);
  if (statusMatch) return statusMatch[1];

  return null;
};

/**
 * 从CSP错误响应XML中提取错误描述
 * 
 * @param {string} xml - CSP错误响应XML
 * @returns {string} 错误描述
 */
export const extractErrorMsgFromXml = (xml) => {
  if (!xml || typeof xml !== 'string') return '未知错误';

  const descMatch = xml.match(/<statusText[^>]*>([^<]+)<\/statusText>/);
  if (descMatch) return descMatch[1];

  return xml.substring(0, 200);
};

/**
 * 解析CSP送达状态报告回调XML
 * 
 * @param {string} xml - 平台推送的状态报告XML
 * @returns {{ messageId: string, status: string, phone: string|null, timestamp: string|null }}
 */
export const parseStatusReport = (xml) => {
  if (!xml || typeof xml !== 'string') return { messageId: '', status: 'Unknown' };

  const messageId = xml.match(/<messageId[^>]*>([^<]+)<\/messageId>/)?.[1] || '';
  const status = xml.match(/<deliveryStatus[^>]*>([^<]+)<\/deliveryStatus>/)?.[1]
    || xml.match(/<status[^>]*>([^<]+)<\/status>/)?.[1] || 'Unknown';
  const phone = xml.match(/<senderAddress[^>]*>([^<]+)<\/senderAddress>/)?.[1]
    || xml.match(/<destinationAddress[^>]*>([^<]+)<\/destinationAddress>/)?.[1] || null;
  const timestamp = xml.match(/<timestamp[^>]*>([^<]+)<\/timestamp>/)?.[1] || null;

  return { messageId, status, phone, timestamp };
};

/**
 * 解析CSP上行消息通知回调XML
 * 
 * @param {string} xml - 平台推送的上行消息XML
 * @returns {{ messageId: string, senderAddress: string, content: string|null }}
 */
export const parseInboundMessage = (xml) => {
  if (!xml || typeof xml !== 'string') return { messageId: '', senderAddress: '', content: null };

  const messageId = xml.match(/<messageId[^>]*>([^<]+)<\/messageId>/)?.[1] || '';
  const senderAddress = xml.match(/<senderAddress[^>]*>([^<]+)<\/senderAddress>/)?.[1] || '';
  const content = xml.match(/<bodyText[^>]*>([^<]+)<\/bodyText>/)?.[1] || null;

  return { messageId, senderAddress, content };
};
