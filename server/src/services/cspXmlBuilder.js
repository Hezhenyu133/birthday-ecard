// CSP北向接口 XML请求体构建器
// 遵循V2.4.3规范，构建5G视信发送的XML请求报文

/**
 * 构建群发模板视信XML请求体（视频文件≤2M）
 * 
 * @param {object} params
 * @param {string} params.phone - 目标手机号
 * @param {string} params.videoTemplateId - 审核通过的视频模板ID
 * @param {string} params.contributionId - 会话唯一标识UUID
 * @param {number} [params.temporaryStoredTime=259200] - 离线缓存时长（秒），最大3天
 * @returns {string} XML请求体
 */
export const buildOutboundXml = ({ phone, videoTemplateId, contributionId, temporaryStoredTime = 259200 }) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<msg:outboundMessageRequest xmlns:msg="urn:oma:xml:rest:netapi:messaging:1">
    <destinationAddress>tel:+86${phone}</destinationAddress>
    <contentType>static-template</contentType>
    <bodyText>{"templateID":"${videoTemplateId}"}</bodyText>
    <mmsBodyText>{"templateID":"${videoTemplateId}"}</mmsBodyText>
    <temporaryStoredTime>${temporaryStoredTime}</temporaryStoredTime>
    <contributionID>${contributionId}</contributionID>
    <storeSupported>true</storeSupported>
</msg:outboundMessageRequest>`;
};

/**
 * 构建群发模板视信XML请求体（视频文件2M~5M）
 * 使用mmsBodyTextLarge字段替代mmsBodyText
 * 
 * @param {object} params - 同buildOutboundXml
 * @returns {string} XML请求体
 */
export const buildOutboundXmlLarge = ({ phone, videoTemplateId, contributionId, temporaryStoredTime = 259200 }) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<msg:outboundMessageRequest xmlns:msg="urn:oma:xml:rest:netapi:messaging:1">
    <destinationAddress>tel:+86${phone}</destinationAddress>
    <contentType>static-template</contentType>
    <bodyText>{"templateID":"${videoTemplateId}"}</bodyText>
    <mmsBodyTextLarge>{"templateID":"${videoTemplateId}"}</mmsBodyTextLarge>
    <temporaryStoredTime>${temporaryStoredTime}</temporaryStoredTime>
    <contributionID>${contributionId}</contributionID>
    <storeSupported>true</storeSupported>
</msg:outboundMessageRequest>`;
};
