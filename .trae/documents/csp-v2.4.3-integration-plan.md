# 中国移动5G视信CSP北向接口V2.4.3接入方案

## Context

当前项目的短信/彩信发送使用通用 REST API（`POST /api/v1/send_sms`、`POST /api/v1/send_mms`），与实际生产环境的中国移动5G视信平台不兼容。用户提供了一份 CSP V2.4.3 规范文档，要求按照该规范改造发送逻辑，包括：双层SHA256鉴权、XML请求体、模板化5G视信发送、回调状态报告接收。

## 方案：新增 `csp` provider，保留 mock/carrier 不变

### 新建文件（4个）

1. **`server/src/services/cspAuthService.js`** — CSP双层SHA256+Base64鉴权
   - `generateCspAuth(appid, password)` → `{ authorization, date }`
   - 使用 `crypto.createHash('sha256')`，无需新增 npm 依赖

2. **`server/src/services/cspXmlBuilder.js`** — XML请求体构建
   - `buildOutboundXml({ phone, videoTemplateId, contributionId })` — 视频≤2M
   - `buildOutboundXmlLarge({ phone, videoTemplateId, contributionId })` — 视频2M~5M
   - `DESTINATION_ADDRESS: tel:+86{phone}`, `contentType: static-template`

3. **`server/src/utils/cspXmlParser.js`** — XML响应/回调解析（正则提取，不引入XML库）

4. **`server/src/routes/cspCallbacks.js`** — CSP平台回调路由（无需JWT认证）
   - `POST /csp/notifications/StatusReportNotification/:chatbotUri` — 送达状态报告
   - `POST /csp/notifications/InboundMessageNotification/:chatbotUri` — 上行消息

### 修改文件（7个）

5. **`server/src/config/index.js`** — 新增 `config.sms.csp` 配置块
   - appid, password, serverRoot, fileServerRoot, chatbotURI, videoTemplateId, callbackURL

6. **`server/.env`** — 新增 CSP 环境变量（CSP_APPID, CSP_PASSWORD, CSP_SERVER_ROOT 等）

7. **`server/src/models/SendRecord.js`** — 扩展模型
   - 新增 `csp_status` VARCHAR(50)、`csp_contribution_id` VARCHAR(200)
   - `send_type` ENUM 扩展为 `('sms', 'mms', '5g_video')`

8. **`server/src/utils/migrate.js`** — 新增迁移项（3项：csp_status, csp_contribution_id, send_type扩展）

9. **`server/src/services/smsService.js`** — 核心改造
   - `sendSMS()` 新增 `provider === 'csp'` 分支
   - 新增 `_cspSend()` 函数：鉴权→选模板字段→构建XML→HTTPS POST→解析响应
   - 新增 `_parseCspResponse()` 解析 CSP XML 响应
   - `_sendWithRetry()` 支持限流错误(31008)更长退避

10. **`server/src/services/sendService.js`** — 适配CSP模式
    - CSP模式下 `send_type` 标记为 `'5g_video'`
    - `buildSmsBody` 在CSP模式下记录模板信息
    - 保存 `csp_contribution_id` 到 SendRecord

11. **`server/src/app.js`** — 注册CSP回调路由
    - `app.use('/csp', cspCallbackRoutes)` — 挂在 `/csp` 前缀下

### 实施顺序

1. 基础工具层：cspAuthService + cspXmlBuilder + cspXmlParser（3个新文件，不影响现有功能）
2. 配置层：config + .env
3. 数据模型：SendRecord + migrate
4. 核心发送：smsService + sendService
5. 回调路由：cspCallbacks + app.js
6. 测试验证

### 验证方式

- `SMS_PROVIDER=mock` 行为不变
- `SMS_PROVIDER=csp` 且 CSP 配置为空时，发送应报错"CSP配置不完整"
- 检查鉴权头格式：`Basic base64(appid:sha256(sha256(password)+GMT))`
- 检查 XML 请求体格式符合规范
- 回调端点可本地 `curl -X POST` 测试
