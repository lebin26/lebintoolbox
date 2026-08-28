# OmniBox 项目树与多 App 架构管理指南 (`docs/PROJECT_TREE.md`)

本文档定义了 **OmniBox 多功能应用聚合平台** 的全局项目树、模块分层规范与架构布局。

---

## 🌟 1. OmniBox 平台生态概览

- **平台名称 (Platform)**: **OmniBox** (多功能工具聚合平台)
- **核心底座 (Core Services)**:
  - 极简单页应用路由调度器 (`AppRouter`)
  - 全局主题引擎 (`AppTheme`: 深色 / 浅色 / 跟随系统)
  - 底部抽屉与通用模态浮层 (`AppDrawer`)
- **当前包含子应用 (Sub-Apps)**:
  1. 🏸 **Court Ledger** (羽毛球活动 AA 场费测算、用球平摊、球场数据管理与历史账单)
  2. 💰 **Financial Overview** (月度财务总览、资产配置、多币种换算、历史资产折线趋势与跨月对比矩阵)

---

## 🌳 2. OmniBox 完整纯净项目树 (Project Tree)

```text
OmniBox/
├── docs/                              # [文档中心] 架构规范、API、数据库与开发指南
│   ├── ARCHITECTURE.md                # OmniBox 整体全栈架构设计规范
│   ├── PROJECT_TREE.md                # [本文件] OmniBox 项目树与多 App 管理指南
│   ├── API.md                         # Cloudflare Worker REST API 接口文档
│   ├── DATABASE.md                    # Cloudflare D1 数据库设计与字段字典
│   ├── NEW_SUBAPP_SPEC.md             # Sub-App #2 需求与技术规范
│   └── TODO.md                        # 后续迭代与功能规划
├── frontend/                          # [前端层] 原生无编译极简 SPA (Vanilla JS + CSS)
│   ├── index.html                     # 平台统一 HTML 骨架、视图容器与模态弹窗
│   ├── favicon.ico                    # 站点图标
│   ├── assets/                        # 静态资源
│   │   ├── favicon.ico
│   │   └── logo.png
│   ├── css/                           # [样式分层体系]
│   │   ├── variables.css              # 全局设计 Tokens (调色板、圆角、字阶、间距)
│   │   ├── base.css                   # 全局重置、排版、按钮、全屏 Modal 规范
│   │   ├── hub.css                    # OmniBox Hub 主页 (应用启动器卡片网格)
│   │   ├── courtledger.css            # [Sub-App 1: Court Ledger] 专属卡片与算账样式
│   │   └── financial.css              # [Sub-App 2: Financial Overview] 看板、图表与矩阵样式
│   └── js/                            # [JavaScript 模块化业务逻辑]
│       ├── main.js                    # OmniBox 全局生命周期与子系统引导入口
│       ├── core/                      # 平台全局核心底座 (Core Services)
│       │   ├── router.js              # 视图切换器、Hash 路由与导航调度
│       │   ├── theme.js               # 主题切换引擎 (深色/浅色/跟随系统)
│       │   └── drawer.js              # 底部数字抽屉交互器
│       ├── courtledger/               # [Sub-App 1: Court Ledger] 专属业务域
│       │   ├── calculator.js          # 场地费分段计费与用球平摊核心算法引擎
│       │   ├── state.js               # 球场数据库与历史账单云端同步 State
│       │   └── ui.js                  # 算账器交互渲染、DOM 绑定与事件监听
│       └── financial/                 # [Sub-App 2: Financial Overview] 专属业务域
│           ├── api.js                 # 离线/D1 混合数据请求客户端
│           ├── formatters.js          # 货币金额与环比指示格式化工具
│           ├── state.js               # 当前活跃月份与本地缓存管理
│           ├── charts.js              # HTML5 Canvas 原生贝塞尔曲线资产走势引擎
│           └── ui.js                  # 看板、快照录入、机构管理、产品管理与多维矩阵控制器
├── worker/                            # [后端 API 层] Cloudflare Worker Serverless API
│   ├── src/
│   │   ├── index.js                   # API 网关、Court Ledger 端点与静态资源托管
│   │   └── financial.js               # Financial Overview 专属 D1 数据操作端点
│   ├── package.json                   # Worker 依赖配置
│   └── wrangler.jsonc                 # Cloudflare Worker & D1 数据库绑定配置
├── migrations/                        # [数据库层] Cloudflare D1 数据库版本化迁移脚本
│   ├── 0001_create_venues.sql         # [Court Ledger] 球场预设与计费规则表
│   ├── 0002_create_bills.sql          # [Court Ledger] 历史账单表
│   └── 0003_create_financial_overview_tables.sql # [Financial Overview] 机构/产品/快照表
├── tests/                             # [自动化测试套件]
│   ├── api_schema.test.mjs            # 接口参数验证测试
│   ├── calculator.test.mjs            # 场费计算引擎数学逻辑单元测试
│   ├── bills.test.mjs                 # 账单数据模型格式化单元测试
│   ├── courtledger_e2e.test.mjs       # Court Ledger API 端到端集成测试
│   └── financial_overview.test.mjs    # Financial Overview 单元与集成测试
├── package.json                       # 顶层 Monorepo 脚本与开发依赖配置
├── README.md                          # 项目中英文介绍与部署说明
└── AGENTS.md                          # AI Agent 协作开发规范指南
```
