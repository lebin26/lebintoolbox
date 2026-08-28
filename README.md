# OmniBox - 多功能应用聚合平台 (Multi-App Platform)

**OmniBox** 是一款轻量、现代、模块化的高性能应用与效率工具聚合平台。基于 **100% 纯原生、零编译（Zero-Build）极简架构** 构建，免除任何复杂的构建与打包摩擦。

---

## 🌟 包含的子应用 (Sub-Apps)

1. 🏸 **Sub-App #1: Court Ledger**
   - 羽毛球活动智能 AA 场费分段计算（早场/晚场混合费率）
   - 用球成本智能平摊与 Host 免单覆盖测算
   - 球场预设数据库管理与历史账单云端持久化

2. 💰 **Sub-App #2: Financial Overview**
   - 多金融机构（Hong Leong, Maybank, IBKR, TNG 等）与产品分类资产管理
   - 月度资产快照录入、一键复制上月数据与自动汇率锁定换算
   - 动态资产净值卡片、原生 Canvas 贝塞尔走势曲线与 12 个月交叉对比矩阵

---

## 🌳 纯净项目树结构 (Project Tree)

```text
lebintoolbox/
├── docs/                              # [文档中心] 架构、API 与数据库文档
│   ├── ARCHITECTURE.md                # 平台整体架构设计
│   ├── PROJECT_TREE.md                # 完整项目树与子应用管理指南
│   ├── API.md                         # REST API 接口规范
│   ├── DATABASE.md                    # D1 数据库字段字典
│   └── NEW_SUBAPP_SPEC.md             # Sub-App 规范指南
├── frontend/                          # [前端层] 纯原生 SPA (Vanilla JS + CSS)
│   ├── index.html                     # 统一单页入口与模态视图
│   ├── favicon.ico
│   ├── assets/
│   ├── css/
│   │   ├── variables.css              # 全局设计变量
│   │   ├── base.css                   # 全局排版与模态底座
│   │   ├── hub.css                    # 主页网格卡片样式
│   │   ├── courtledger.css            # Court Ledger 算账样式
│   │   └── financial.css              # Financial Overview 样式
│   └── js/
│       ├── main.js                    # 主程序入口
│       ├── core/                      # 平台核心 (路由、主题、抽屉)
│       │   ├── router.js
│       │   ├── theme.js
│       │   └── drawer.js
│       ├── courtledger/               # Sub-App #1 业务逻辑
│       │   ├── calculator.js
│       │   ├── state.js
│       │   └── ui.js
│       └── financial/                 # Sub-App #2 业务逻辑
│           ├── api.js
│           ├── formatters.js
│           ├── state.js
│           ├── charts.js
│           └── ui.js
├── worker/                            # [后端层] Cloudflare Worker Serverless API
│   ├── src/
│   │   ├── index.js                   # API 网关与静态资产托管
│   │   └── financial.js               # 金融总览专属端点
│   ├── package.json
│   └── wrangler.jsonc                 # D1 数据库与 Assets 绑定配置
├── migrations/                        # [数据库层] D1 迁移脚本
│   ├── 0001_create_venues.sql         # 球场表
│   ├── 0002_create_bills.sql          # 账单表
│   └── 0003_create_financial_overview_tables.sql # 金融机构/产品/快照表
├── tests/                             # [测试套件]
│   ├── api_schema.test.mjs
│   ├── bills.test.mjs
│   ├── calculator.test.mjs
│   ├── courtledger_e2e.test.mjs
│   └── financial_overview.test.mjs
├── package.json                       # 项目根配置
└── AGENTS.md                          # 协作开发规范
```

---

## 🚀 快速启动与部署

```bash
# 启动全栈开发环境 (静态前端 + D1 API 一体化运行)
npm run dev

# 运行自动化测试
npm test

# 部署至 Cloudflare 生产环境
npm run worker:deploy
```
