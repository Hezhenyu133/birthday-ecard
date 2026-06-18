# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

工会生日彩信和电子贺卡系统 — 在员工生日当天自动发送包含个性化电子贺卡链接的彩信/短信。

**开发者身份**：大二计算机专业学生，正在学习全栈开发，代码需要学习友好。

**协同开发**：
- 后端开发（back 分支）：API 实现、数据库设计、定时任务、贺卡生成、SMS 服务
- 前端开发（front 分支）：管理后台界面、贺卡展示页面实现
- 主分支 main 用于合并

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Node.js + Express | 5.x, ES Modules |
| Frontend | Vue 3 + TypeScript + Element Plus + Vite | Vue 3.4+, Vite 5.4 |
| Database | MySQL + Sequelize ORM | MySQL 8.0+ |
| Authentication | JWT (jsonwebtoken + bcryptjs) | - |
| Scheduling | node-cron | - |
| SMS | axios + Provider 抽象模式 | mock/carrier 双模式 |
| Excel Import | xlsx (SheetJS) | - |

## Development Commands

```bash
# Backend (server/)
npm install          # 安装后端依赖
npm run dev          # 开发模式启动（nodemon）
npm start            # 生产模式启动

# Frontend (admin-web/)
npm install          # 安装前端依赖
npm run dev          # Vite 开发服务器
npm run build        # 生产构建
```

## Document Navigation

详细技术信息请查阅以下文档，避免在本文件中重复：

| 文档 | 内容 |
|------|------|
| **README.md** | 项目简介、快速启动、文档索引 |
| **生日贺卡项目开发文档.md** | 完整技术设计：架构、数据库、API、前端指南、生产部署 |
| **项目指南.md** | 新手教程：环境准备、启动步骤、功能使用教程 |
| **代码审查与优化总结报告.md** | 版本迭代记录：66 个问题的发现与修复详情（v1.0 ~ v3.2） |

## Git Workflow

- **back 分支**：后端开发，由后端开发者维护
- **front 分支**：前端开发，由前端开发者维护
- **main 分支**：合并目标
- `.gitignore` 已排除 `代码审查与优化总结报告.md` 和 `生日贺卡项目开发文档.md`

## AI Coding Guidelines

以下规则在本项目代码编写中必须遵守：

### 模板系统
- 贺卡模板使用 `<!-- editable-start -->` / `<!-- editable-end -->` 标记定义可编辑区域
- 占位符：`{{name}}`、`{{department}}`、`{{position}}`、`{{birthday}}`、`{{sender}}`、`{{blessing}}`、`{{year}}`
- `{{deptBlock}}` 是条件占位符，由后端根据部门/职位是否为空动态生成
- 模板文件使用中文命名（如 蛋糕.html、星光.html），存放于 `uploads/4页/`
- 模板自动入库：启动时扫描 `server/src/data/` 下所有 `.html` 文件并 upsert

### 删除操作
- 所有删除均为数据库硬删除（非软删除）
- 删除员工时级联删除其所有发送记录
- 删除模板时自动解除关联员工的默认模板绑定
- 删除祝福语时关联模板的 `default_blessing_id` 自动置 null

### SMS 服务
- Provider 抽象模式：`mock`（开发）/ `carrier`（生产）
- 内置指数退避重试机制
- SendRecord 追踪字段：`message_id`、`sms_provider`、`retry_count`

### 前端规范
- 模板编辑采用纯文本编辑模式（非 HTML 编辑）
- 上传文件时不要手动设置 `Content-Type`，让浏览器自动处理 boundary
- 路由守卫使用 Pinia Store 的 `useUserStore().getToken()` 判断登录状态
- 响应拦截器需检测 `Content-Type: text/html`，模板预览接口返回 HTML

### 安全要求
- API 输入使用白名单过滤（`sanitizeInput` / `sanitizeEmployeeInput`）
- 贺卡 cardId 使用 UUID v4 + `path.basename()` 防止路径遍历
- 生产环境 `JWT_SECRET` 必须为随机长字符串
