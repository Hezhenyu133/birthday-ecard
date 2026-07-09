// CSP平台回调路由
// 接收中国移动5G视信平台推送的送达状态报告和上行消息通知
// 这些端点不需要JWT认证（平台推送无法携带我们的Token）

import { Router } from 'express';
import SendRecord from '../models/SendRecord.js';
import { parseStatusReport, parseInboundMessage } from '../utils/cspXmlParser.js';

const router = Router();

/**
 * 视频短信投递状态报告回调
 * CSP平台在消息送达/失败后推送此通知
 * 
 * URL格式: POST /csp/notifications/StatusReportNotification/{chatbotUri}
 */
router.post('/notifications/StatusReportNotification/:chatbotUri', async (req, res) => {
  try {
    const xmlData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    console.log('[CSP回调] 收到状态报告');

    const report = parseStatusReport(xmlData);
    console.log(`[CSP回调] 消息ID: ${report.messageId}, 状态: ${report.status}`);

    // 根据messageId或contributionId更新发送记录
    if (report.messageId) {
      const record = await SendRecord.findOne({
        where: { message_id: report.messageId }
      });
      if (record) {
        await record.update({
          csp_status: report.status,
          // 根据CSP状态映射本地状态
          send_status: mapCspStatusToSendStatus(report.status, record.send_status)
        });
        console.log(`[CSP回调] 已更新记录 #${record.id}, CSP状态: ${report.status}`);
      } else {
        console.warn(`[CSP回调] 未找到消息ID: ${report.messageId} 对应的发送记录`);
      }
    }

    res.status(200).send('success');
  } catch (err) {
    console.error('[CSP回调] 状态报告处理失败:', err.message);
    res.status(200).send('success'); // 必须返回200，否则平台会重试
  }
});

/**
 * 用户上行消息通知回调
 * 用户回复5G视信消息时推送此通知
 * 
 * URL格式: POST /csp/notifications/InboundMessageNotification/{chatbotUri}
 */
router.post('/notifications/InboundMessageNotification/:chatbotUri', async (req, res) => {
  try {
    const xmlData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    console.log('[CSP回调] 收到上行消息');

    const message = parseInboundMessage(xmlData);
    console.log(`[CSP回调] 发送方: ${message.senderAddress}, 消息ID: ${message.messageId}`);

    // 上行消息目前仅记录日志，不做业务处理
    // 后续可扩展为自动回复或触发其他业务流程

    res.status(200).send('success');
  } catch (err) {
    console.error('[CSP回调] 上行消息处理失败:', err.message);
    res.status(200).send('success');
  }
});

/**
 * 将CSP送达状态映射为本地发送状态
 * 
 * CSP状态值参考V2.4.3规范：
 * - DeliveredToNetwork: 已送达网络
 * - DeliveredToTerminal: 已送达终端
 * - DeliveryFailed: 投递失败
 * - Displayed: 已展示
 */
const mapCspStatusToSendStatus = (cspStatus, currentStatus) => {
  if (!cspStatus) return currentStatus;

  const lower = cspStatus.toLowerCase();
  if (lower.includes('failed') || lower.includes('error')) {
    return 'failed';
  }
  if (lower.includes('delivered') || lower.includes('displayed')) {
    return 'success';
  }
  return currentStatus;
};

export default router;
