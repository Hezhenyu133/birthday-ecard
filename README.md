# 工会生日彩信和电子贺卡系统

面向企业工会的生日祝福自动化管理平台。系统根据员工生日信息自动生成个性化电子贺卡，并通过彩信/短信将贺卡链接发送给员工。

**核心流程**：录入员工信息 → 系统每日 08:00 检查当天生日 → 自动匹配贺卡模板 → 生成个性化贺卡 → 发送彩信/短信

## 功能概览

- **仪表盘** — 员工总数、模板数量、发送统计、今日生日概览
- **员工管理** — 单个录入、Excel 批量导入、搜索筛选、手动发送贺卡
- **模板管理** — 贺卡 HTML 模板编辑、预览、匹配规则配置、祝福语绑定
- **祝福语管理** — 祝福语增删改查，支持性别和年龄范围匹配
- **发送记录** — 历史记录查询、短信内容展示、手机模拟器预览、重发
- **定时任务** — 每日 08:00 自动检查生日并发送祝福（防重复发送）
- **贺卡访问** — 独立 HTML 页面，4 页翻页式设计，适配移动端浏览器

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 后端 | Node.js + Express 5.x | ES Modules，端口 3000 |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite | 管理后台，端口 5173 |
| 数据库 | MySQL 8.0+ + Sequelize ORM | 自动建表 |
| 认证 | JWT (jsonwebtoken + bcryptjs) | Token 认证，24h 过期 |
| 定时任务 | node-cron | 每日 08:00（Asia/Shanghai） |
| 短信 | SMS Provider 抽象 | mock（开发）/ carrier（生产） |

## 快速启动

### 环境要求

Node.js 18+、npm 9+、MySQL 8.0+

### 1. 创建数据库

```sql
CREATE DATABASE birthday DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置后端

```bash
cd server
cp .env.example .env
# 编辑 .env，填写 DB_PASSWORD 和 JWT_SECRET
npm install
npm run dev
```

### 3. 启动前端

```bash
cd admin-web
npm install
npm run dev
```

### 4. 访问系统

浏览器打开 `http://localhost:5173`，使用默认管理员账号登录：
- 用户名：`admin`
- 密码：`123456`

详细启动教程和常见问题排查请参阅 [项目指南](项目指南.md)。

## 项目文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI 助手工作指南（面向 AI 编码助手） |
| [项目指南.md](项目指南.md) | 新手教程：环境准备、详细启动步骤、功能使用教程 |
| [生日贺卡项目开发文档.md](生日贺卡项目开发文档.md) | 技术设计文档：架构、数据库、API、前端指南、生产部署 |
| [代码审查与优化总结报告.md](代码审查与优化总结报告.md) | 版本迭代记录：78 个问题（v1.0 ~ v3.5） |

## 项目结构

```
birthday-card-system/
├── server/              # 后端 Express API 服务
├── admin-web/           # 前端 Vue 3 管理后台
├── uploads/             # 贺卡模板备份目录
├── AGENTS.md            # AI 助手指南
├── 项目指南.md           # 新手教程
├── 生日贺卡项目开发文档.md  # 技术设计 + 部署文档
├── 代码审查与优化总结报告.md  # 版本迭代记录
└── README.md            # 本文件
```

## 版本

当前版本：v3.5.0
项目1.0 阶段3、4、5、6