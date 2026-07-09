# 模板清理与视频录制功能实施计划

## 当前状态分析

### 问题 1：旧模板未删除
- `server/src/data/` 目录存在 11 个旧模板 HTML 文件
- `initDefaultTemplate.js` 的 `TEMPLATE_MANIFEST` 仍包含这些旧模板定义
- 服务器启动时会自动导入这些旧模板到数据库

### 问题 2：视频录制功能缺失
- 5 个新模板目录已存在（birthday-card-13 至 17），各有独立的 `record.js`
- 每个模板的录制配置不同（屏幕顺序、时长等）
- 服务端视频录制服务尚未创建
- 发送流程未集成视频录制
- 短信服务不支持彩信/视频附件
- 数据库模型缺少视频相关字段

## 实施步骤

### 阶段 1：清理旧模板

#### 1.1 删除旧模板文件
- 删除 `server/src/data/` 下所有 11 个 HTML 文件：
  - 蛋糕.html、粉色.html、礼盒.html、派对.html、星光.html
  - 红礼盒.html、寿桃.html、烟花.html
  - 通用1.html、通用2.html、通用3.html

#### 1.2 更新模板初始化脚本
- 文件：`server/src/utils/initDefaultTemplate.js`
- 清空 `TEMPLATE_MANIFEST` 数组（保留结构但移除所有旧模板条目）
- 保留自动发现机制，但 `src/data/` 为空时不会导入任何模板

#### 1.3 导入新模板
- 运行 `server/import-new-templates.js` 脚本
- 验证数据库中只有 5 个新模板

### 阶段 2：创建视频录制基础设施

#### 2.1 创建视频模板配置
- 新建文件：`server/src/config/videoTemplates.js`
- 从各模板的 `record.js` 提取配置信息：
  - birthday-card-13：4 屏，每屏 3 秒，共 12 秒
  - birthday-card-14：4 屏，每屏 3 秒，共 12 秒
  - birthday-card-15：7 屏，每屏 3.7 秒，共 26 秒
  - birthday-card-16：7 屏，每屏 3.7 秒，共 26 秒
  - birthday-card-17：7 屏，每屏 3.7 秒，共 26 秒
- 导出 `getVideoConfig(templateName)` 函数用于查询配置

#### 2.2 创建视频录制服务
- 新建文件：`server/src/services/videoRecorderService.js`
- 将模板目录的 CommonJS `record.js` 改写为 ESM 模块
- 核心功能：
  - 创建临时目录并写入个性化 HTML
  - 启动静态服务器（支持访问父目录的 music 和 logo）
  - 使用 Playwright 录制 webm 视频
  - 使用 ffmpeg 压缩为 mp4（目标 ≤2MB）
  - 清理临时文件
- 导出 `recordVideo({ personalizedHtml, recordConfig, outputDir, cardId })` 函数

#### 2.3 更新配置文件
- 文件：`server/src/config/index.js`
- 添加视频相关配置：
  ```javascript
  video: {
    enabled: process.env.VIDEO_ENABLED !== 'false',
    outputDir: process.env.VIDEO_OUTPUT_DIR || './generated-videos',
    tempDir: process.env.VIDEO_TEMP_DIR || './.video-temp',
    retentionDays: parseInt(process.env.VIDEO_RETENTION_DAYS) || 7
  }
  ```

### 阶段 3：扩展数据库模型

#### 3.1 更新 SendRecord 模型
- 文件：`server/src/models/SendRecord.js`
- 新增字段：
  - `video_path`：STRING(500)，视频文件路径
  - `send_type`：ENUM('sms', 'mms')，发送类型

### 阶段 4：扩展短信服务支持彩信

#### 4.1 更新配置文件
- 文件：`server/src/config/index.js`
- 添加新的 API 配置：
  ```javascript
  sms: {
    provider: smsProvider,
    apiUrl: process.env.SMS_API_URL || '',
    mmsApiUrl: process.env.MMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || '',
    // ... 其他配置
  }
  ```

#### 4.2 更新 SMS 服务
- 文件：`server/src/services/smsService.js`
- 修改 `sendSMS` 函数签名，增加 `options` 参数
- 当 `options.videoPath` 存在时：
  - mock 模式：记录日志显示发送彩信
  - carrier 模式：调用 `/api/v1/send_mms` 接口
    - 使用 form-data 构建 multipart/form-data 请求
    - 参数：`to` (手机号), `content` (彩信内容), `attachment` (视频文件)
    - 添加 Authorization header
- 当 `options.videoPath` 不存在时：
  - 调用 `/api/v1/send_sms` 接口
  - 参数：`to` (手机号), `msg` (短信内容)
  - 添加 Authorization header
- 保持向后兼容，不传 options 时行为不变

### 阶段 5：集成视频录制到发送流程

#### 5.1 更新发送服务
- 文件：`server/src/services/sendService.js`
- 在生成贺卡后，检查模板是否有视频配置
- 如有配置且视频功能启用：
  - 调用 `recordVideo()` 录制个性化视频
  - 捕获录制失败异常，降级为普通 SMS
- 将视频路径传递给 `sendSMSWithRetry`
- 更新 SendRecord 记录视频路径和发送类型

#### 5.2 更新重试包装器
- 修改 `sendSMSWithRetry` 函数签名，支持传递 videoPath
- 确保重试逻辑正确处理彩信发送

### 阶段 6：安装依赖

#### 6.1 确认必需依赖
- 检查 `server/package.json` 是否已包含：
  - `playwright`：浏览器自动化
  - `form-data`：构建 multipart 请求
- 如缺失，执行 `npm install` 安装

### 阶段 7：测试验证

#### 7.1 验证模板清理
- 重启服务器，检查日志确认无旧模板导入
- 查询数据库确认只有 5 个新模板

#### 7.2 验证视频录制
- 手动触发一次发送（通过 API 或定时任务）
- 检查 `generated-videos/` 目录是否生成 mp4 文件
- 检查 SendRecord 记录是否包含 video_path 和 send_type='mms'
- 验证录制失败时能正确降级为普通 SMS

## 关键文件清单

### 需要删除的文件
- `server/src/data/蛋糕.html`
- `server/src/data/粉色.html`
- `server/src/data/礼盒.html`
- `server/src/data/派对.html`
- `server/src/data/星光.html`
- `server/src/data/红礼盒.html`
- `server/src/data/寿桃.html`
- `server/src/data/烟花.html`
- `server/src/data/通用1.html`
- `server/src/data/通用2.html`
- `server/src/data/通用3.html`

### 需要修改的文件
- `server/src/utils/initDefaultTemplate.js`：清空 TEMPLATE_MANIFEST
- `server/src/config/index.js`：添加视频配置
- `server/src/models/SendRecord.js`：添加视频字段
- `server/src/services/smsService.js`：支持彩信发送
- `server/src/services/sendService.js`：集成视频录制

### 需要创建的文件
- `server/src/config/videoTemplates.js`：视频模板配置
- `server/src/services/videoRecorderService.js`：视频录制服务

### 需要运行的脚本
- `server/import-new-templates.js`：导入 5 个新模板

## 技术要点

### 视频录制流程
1. 从模板目录读取 record.js 配置（screenOrder、pageDuration）
2. 创建临时目录，写入个性化 HTML（替换占位符）
3. 启动静态服务器，支持访问 `贺卡模板/music/` 和 `logo.svg`
4. Playwright 无头浏览器按 screenOrder 自动翻页录制
5. ffmpeg 两遍压缩：webm → mp4（H.264 + AAC，≤2MB）
6. 清理临时文件，返回视频路径

### 彩信发送逻辑
- 检测 videoPath 是否存在
- 存在时使用 form-data 构建 multipart/form-data 请求
- 附加视频文件（Content-Type: video/mp4）
- 超时时间延长至 3 倍（视频上传较慢）

### 降级策略
- 视频录制失败时捕获异常
- 记录错误日志
- 继续执行普通 SMS 发送（仅发送链接）
- SendRecord 记录 send_type='sms'，video_path=null

## 预期结果

1. 系统中只有 5 个新模板，无旧模板残留
2. 发送生日贺卡时自动录制个性化视频
3. 视频通过彩信附件发送（或降级为普通短信）
4. SendRecord 完整记录发送类型和视频路径
5. 录制失败不影响贺卡发送流程