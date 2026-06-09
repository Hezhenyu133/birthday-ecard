# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

工会生日彩信和电子贺卡系统 - 在员工生日当天自动发送包含个性化电子贺卡链接的彩信/短信。

**开发者身份**：大二计算机专业学生，正在学习全栈开发，代码需要学习友好。

**协同开发**：
- 后端开发（back 分支）：API 实现、数据库设计、定时任务、贺卡生成、SMS 服务
- 前端开发（front 分支）：管理后台界面、贺卡展示页面实现
- 主分支 main 用于合并

## Technology Stack

| Layer | Technology | Version |
|-------|------------|--------|
| Backend | Node.js + Express | 5.x, ES Modules |
| Frontend | Vue 3 + TypeScript + Element Plus + Vite | Vue 3.4+, Vite 5.4 |
| Database | MySQL + Sequelize ORM | MySQL 8.0+ |
| Authentication | JWT (jsonwebtoken + bcryptjs) | - |
| Scheduling | node-cron | - |
| SMS | axios + Provider 抽象模式 | mock/carrier 双模式 |
| Excel Import | xlsx (SheetJS) | - |
| Deployment | Windows Server / Linux | - |

### Frontend Dependencies
- **vue**: 3.4.0+ - 核心框架
- **vue-router**: 4.2.5+ - 路由管理
- **pinia**: 3.0.4+ - 状态管理
- **element-plus**: 2.14.1+ - UI 组件库
- **axios**: 1.6.0+ - HTTP 客户端
- **@element-plus/icons-vue**: 2.3.2+ - 图标库

## Architecture

项目采用前后端分离架构：

- **server/** - 后端 Express API 服务
- **admin-web/** - Vue 3 前端管理后台
- **uploads/4页/** - 贺卡 HTML 模板文件（中文命名，含 admin 返回按钮）
- **server/generated-cards/** - 动态生成的贺卡 HTML 文件存储目录
- **server/uploads/** - Excel 上传临时目录
- 贺卡展示页面为纯 HTML/CSS/JS 实现，不依赖 Vue 框架

```
birthday-card-system/
├── server/                      # 后端服务
│   ├── src/
│   │   ├── app.js              # 应用入口 + 启动逻辑
│   │   ├── config/             # 配置 (数据库、应用、SMS)
│   │   ├── models/             # 数据模型 (Admin, Employee, Template, SendRecord, Blessing)
│   │   ├── routes/             # API路由 (auth, employees, templates, records, card, blessings)
│   │   ├── middlewares/        # 中间件 (认证、错误处理)
│   │   ├── services/           # 业务服务 (调度器, 贺卡生成, 模板匹配, SMS)
│   │   ├── utils/              # 工具函数 (JWT, 响应格式, Excel解析, 模板种子, 数据库迁移)
│   │   └── data/               # 模板 HTML 文件（启动时自动入库）
│   ├── generated-cards/        # 运行时生成的贺卡 HTML
│   ├── uploads/                # Excel 上传临时目录
│   └── .env                    # 环境变量配置
├── uploads/                    # 贺卡模板目录（中文命名）
│   └── 4页/                   # 4页翻页式贺卡模板
│       ├── _template_skeleton.html  # 通用骨架模板
│       ├── 蛋糕.html / 粉色.html / 礼盒.html  # 各主题模板
│       ├── 派对.html / 星光.html / 红礼盒.html
│       ├── 寿桃.html / 烟花.html
│       ├── 通用1.html / 通用2.html
│       └── ...
├── admin-web/                  # 前端管理后台
│   ├── src/
│   │   ├── api/               # API 接口封装 (auth, employees, templates, records, blessings)
│   │   ├── views/             # 页面组件 (10个页面)
│   │   ├── components/        # 公共组件 (MainLayout)
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── router/            # 路由配置
│   │   ├── main.ts            # 入口文件
│   │   └── style.css          # 全局样式
│   ├── card_template/         # 贺卡参考模板（非源码）
│   ├── vite.config.ts         # Vite 配置
│   └── package.json
├── AGENTS.md                  # AI 助手指南
└── README.md                  # 项目说明
```

## Development Commands (To Be Implemented)

项目初始化后，预期使用以下命令：

```bash
# Backend (server/)
npm install          # 安装后端依赖
npm run dev          # 开发模式启动（nodemon）
npm start            # 生产模式启动
npm test             # 运行测试（待实现）

# Frontend (admin-web/)
npm install          # 安装前端依赖
npm run dev          # Vite开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run lint         # ESLint检查（待配置）
```

## Key Technical Points

### Backend Development
- 使用 Sequelize ORM 操作 MySQL，5 个模型：Admin、Employee、Template、SendRecord、Blessing
- 路由按模块划分：`auth.js`、`employees.js`、`templates.js`、`records.js`、`card.js`、`blessings.js`
- 定时任务服务 `scheduler.js` 每日 08:00 检查生日员工
- 模板匹配服务 `templateMatcher.js` 按优先级：手动指定 > 性别+年龄 > 性别 > 通用模板
- 贺卡生成服务 `cardGenerator.js` 替换占位符生成 HTML 文件
- SMS 服务 `smsService.js` 支持 mock/carrier 双模式，内置指数退避重试机制
- 数据库迁移工具 `migrate.js` 启动时自动为已存在的表添加新列
- 模板种子工具 `initDefaultTemplate.js` 自动发现 `src/data/` 下所有 HTML 文件并入库
- 所有 API 使用统一响应格式，JWT 认证保护管理接口

### Frontend Development
- 10 个页面组件：Dashboard、EmployeeList、EmployeeForm、EmployeeImport、TemplateList、TemplateEdit、BlessingList、BlessingEdit、SendRecords、Login
- 模板、祝福语、发送记录、员工均支持删除功能（全部为数据库硬删除，级联清除关联数据）
- 模板编辑采用纯文本编辑模式，通过 `<!-- editable -->` 标记提取可编辑区域
- 发送记录页面展示短信内容和手机预览功能
- 使用 Pinia 管理用户状态（token 存储）
- axios 配置请求拦截器添加 JWT 认证头
- 路由守卫控制页面访问权限
- TypeScript 类型定义保证类型安全

### SMS Service
- Provider 抽象模式：`mock`（开发环境模拟发送）/ `carrier`（对接运营商 API）
- 短信内容格式：`亲爱的XX，祝您生日快乐！点击查看您的专属贺卡：{cardUrl}`
- SendRecord 跟踪字段：`message_id`、`sms_provider`、`retry_count`
- 切换到真实运营商只需修改 `.env` 中的 `SMS_PROVIDER` 和相关认证参数

### Template System
- **模板存储**：`uploads/4页/` 目录下的中文命名 HTML 文件（如 蛋糕.html、礼盒.html）
- **自动发现**：启动时自动扫描 `server/src/data/` 下所有 `.html` 文件并写入数据库（幂等 upsert）
- **模板骨架**：`_template_skeleton.html` 为通用开发骨架，含 4 页翻页、Web Audio API 音乐播放、入场动画
- **模板命名规范**：中文主题名（如 蛋糕、粉色、礼盒、派对、星光、红礼盒、寿桃、烟花、通用1、通用2）
- **admin 按钮**：每个模板左上角固定「返回管理后台」按钮，链接 `http://localhost:5173`，配色匹配模板主题
- **可编辑区域标记**：`<!-- editable-start -->` 和 `<!-- editable-end -->` 包裹祝福文本
- **占位符**：`{{name}}`、`{{department}}`、`{{position}}`、`{{birthday}}`、`{{sender}}`、`{{blessing}}`、`{{year}}`
- **祝福语管理**：Blessing 模型支持祝福语的增删改查，模板可绑定默认祝福语

## Documentation Guidelines

- 技术设计文档避免包含具体代码示例，保持简洁明了
- 文档内容应适合前端负责人阅读理解
- 内容冲突时需向用户确认后再处理

## API Structure

API 接口规范详见技术设计文档，核心接口模块：

- `/api/auth/*` - 认证相关（登录、修改密码）
- `/api/employees/*` - 员工管理（CRUD、批量导入、手动发送、**硬删除+级联删除发送记录**）
- `/api/templates/*` - 模板管理（CRUD、预览、**硬删除+解除员工绑定**）
- `/api/blessings/*` - 祝福语管理（CRUD、**硬删除+解除模板绑定**）
- `/api/records/*` - 发送记录查询、统计、测试发送、**硬删除**
- `/card/:cardId` - 贺卡公开访问（无需认证）

## Git Workflow

- **back 分支**：后端开发，由后端开发者维护
- **front 分支**：前端开发，由前端开发者维护
- **main 分支**：合并目标
- `.gitignore` 已排除 `代码审查与优化总结报告.md` 和 `生日贺卡项目开发文档.md`