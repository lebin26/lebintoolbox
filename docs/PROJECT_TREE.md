# OmniBox 项目树与多 App 架构管理指南 (`docs/PROJECT_TREE.md`)

本文档定义了 **OmniBox 多功能应用聚合平台** 的全局项目树、模块分层规范，以及如何高效拓展、维护与管理平台内所有子应用（Sub-Apps）。

---

## 🌟 1. OmniBox 平台与 App 生态概览

- **平台名称 (Platform)**: **OmniBox** (万能工具箱 / 多功能个人与团队效率聚合平台)
- **核心底座 (Core Services)**:
  - 统一账号体系与 RBAC 权限控制 (`AuthManager`)
  - 极简单页路由与全屏子窗口调度 (`AppRouter`)
  - 全局主题与外观引擎 (`AppTheme`: Dark / Light / System)
  - 全局系统控制台与审计流 (`AdminModule`)
- **当前子应用 (Current App)**:
  - 🏸 **Court Ledger** (羽毛球活动 AA 算账、用球平摊、球场数据管理与历史账单)

---

## 🌳 2. OmniBox 完整项目树 (Project Tree)

```text
OmniBox/
├── .github/                           # GitHub Actions CI/CD 工作流
│   └── workflows/
├── docs/                              # [文档中心] 架构规范、API、数据库与开发指南
│   ├── ARCHITECTURE.md                # OmniBox 整体全栈架构设计规范
│   ├── PROJECT_TREE.md                # [本文件] OmniBox 项目树与多 App 管理指南
│   ├── API.md                         # Cloudflare Worker REST API 接口文档
│   ├── DATABASE.md                    # Cloudflare D1 数据库设计与字段字典
│   └── TODO.md                        # 需求规划与代办清单
├── frontend/                          # [前端层] 现代极简 SPA (Vanilla JS + Vite)
│   ├── index.html                     # 平台统一 HTML 骨架、视图挂载容器与全屏弹窗
│   ├── app.js                         # 前端入口代理
│   ├── start.sh                       # 本地热更新全栈开发一键启动脚本
│   ├── assets/                        # 全局共享静态资源 (图标、二维码等)
│   │   ├── favicon.ico
│   │   └── qr.png
│   ├── css/                           # [样式分层体系] 统一设计令牌与模块化样式
│   │   ├── variables.css              # 全局设计 Tokens (调色板、圆角、字阶、间距)
│   │   ├── base.css                   # 全局重置、排版、按钮、全屏 Modal 规范
│   │   ├── hub.css                    # OmniBox Hub 主页 (应用网格、登录、Admin后台)
│   │   └── courtledger.css            # [App 1: Court Ledger] 专属卡片与算账视图样式
│   ├── views/                         # [HTML 视图碎片] 独立子应用与功能视图模板
│   │   ├── hub.html                   # OmniBox 首页应用网格 (App Launcher)
│   │   ├── courtledger.html           # [App 1: Court Ledger] 算账主界面与历史账单
│   │   └── <new_app>.html             # [未来新增 App] 独立 HTML 视图碎片
│   └── js/                            # [JavaScript 模块化业务逻辑]
│       ├── main.js                    # OmniBox 全局生命周期与子系统引导入口
│       ├── core/                      # 平台全局核心底座 (Core Services)
│       │   ├── auth.js                # 统一用户鉴权、Token 管理与个人中心
│       │   ├── router.js              # 视图切换器、Hash 路由与导航守卫
│       │   ├── theme.js               # 主题切换引擎 (深色/浅色/跟随系统)
│       │   └── drawer.js              # 全屏抽屉与通用弹窗交互器
│       ├── admin/                     # 平台全局管理控制台 (Admin Console)
│       │   └── admin.js               # 用户列表、角色提权/封禁与审计日志流水
│       └── courtledger/               # [App 1: Court Ledger] 专属业务域
│           ├── calculator.js          # 场地费分段计费与用球平摊核心算法引擎
│           ├── state.js               # 球场数据库与历史账单云端同步 State
│           ├── ui.js                  # 算账器交互渲染、DOM 绑定与事件监听
│           ├── bill.js                # AA 账单文本模板格式化与剪贴板导出
│           ├── qr.js                  # 收款二维码浮层与手势缩放
│           └── swipe.js               # 移动端横向滑动手势切换器
├── worker/                            # [后端 API 层] Cloudflare Worker Serverless API
│   ├── src/
│   │   └── index.js                   # 统一 API 路由分发、RBAC 中间件与 D1 操作
│   ├── package.json                   # Worker 依赖配置
│   └── wrangler.jsonc                 # Cloudflare Worker & D1 数据库绑定配置
├── migrations/                        # [数据库层] Cloudflare D1 数据库版本化迁移脚本
│   ├── 0001_create_venues.sql         # [Court Ledger] 球场预设与计费规则表
│   ├── 0002_create_bills.sql          # [Court Ledger] 历史账单表
│   ├── 0003_create_users.sql          # [OmniBox Core] 统一用户表与初始 RBAC
│   ├── 0004_create_admin_logs.sql     # [OmniBox Core] 管理员审计日志表
│   ├── 0005_add_user_id_to_bills.sql  # [Court Ledger] 账单多租户账号物理隔离
│   ├── 0006_add_plain_password...     # [OmniBox Core] 用户管理辅助字段
│   └── 0007_update_usernames...       # [OmniBox Core] 用户名规范化演进
├── tests/                             # [自动化测试套件]
│   ├── api_schema.test.mjs            # 接口参数验证与用户名合规性测试
│   ├── calculator.test.mjs            # 场费计算引擎数学逻辑单元测试
│   ├── bills.test.mjs                 # 账单数据模型格式化单元测试
│   └── courtledger_e2e.test.mjs       # 端到端 Worker API 集成测试
├── package.json                       # 顶层 Monorepo 脚本与开发依赖配置
├── vite.config.js                     # Vite 开发服务器与 API 反向代理配置
└── AGENTS.md                          # AI Agent 与协作开发规范指南
```

---

## 🧩 3. 架构分层职责划分

| 分层 | 目录路径 | 核心职责 |
| :--- | :--- | :--- |
| **OmniBox Core (平台底座)** | `frontend/js/core/`<br>`frontend/css/variables.css`<br>`frontend/css/base.css` | 提供跨 App 的公共设施：登录鉴权、多级角色校验 (RBAC)、Toast 提示、全屏弹窗基础、主题切换。 |
| **OmniBox Hub (应用中枢)** | `frontend/views/hub.html`<br>`frontend/css/hub.css` | 平台首页的 App Launcher 应用启动器卡片网格，以及全局管理员控制台入口。 |
| **App 专属域 (App Domain)** | `frontend/js/<app_name>/`<br>`frontend/views/<app_name>.html`<br>`frontend/css/<app_name>.css` | 每个子 App 拥有自己完全解耦的业务目录，绝不污染全局或其他 App。 |
| **Serverless API (后端网关)** | `worker/src/index.js` | 统一接收所有 App 的请求，提供统一的 CORS、鉴权中间件，并隔离 `/api/<app_name>/*` 业务接口。 |
| **Database (D1 持久化)** | `migrations/` | 平台基础表 (`users`, `admin_logs`) 与各 App 业务表 (`venues`, `bills`)。 |

---

## 🚀 4. 如何在 OmniBox 中新增一个 App (3 步极速集成 SOP)

当需要为 OmniBox 添加一个全新 App（例如：`Expense Tracker`, `Habit Tracker`, `Tournament Bracket` 等）时，只需遵循以下 3 步：

### 第 1 步：创建 App 独立目录与前端模块
1. **新建 JS 目录**: 在 `frontend/js/<app_name>/` 下创建 App 所需的业务逻辑文件（如 `ui.js`, `state.js`）。
2. **新建 CSS 样式**: 在 `frontend/css/<app_name>.css` 中编写专属样式，并在 `frontend/index.html` 的 `<head>` 中引入。
3. **编写 HTML 视图**:
   - 在 `frontend/index.html` 中新增 `<div id="view-<app_name>" class="app-view hidden">...</div>` 视图容器。

### 第 2 步：注册路由与应用桌面卡片
1. **注册路由**: 打开 `frontend/js/core/router.js`，在 `viewTitles` 与 `views` 对象中添加新 App：
   ```javascript
   const viewTitles = {
     hub: 'OmniBox',
     courtledger: 'Court Ledger',
     newapp: 'My New App', // 新增
   };
   ```
2. **在 Hub 主页添加启动卡片**: 打开 `frontend/views/hub.html`（或 `frontend/index.html` 内的 `#view-hub`），添加点击卡片：
   ```html
   <div class="shortcut-card shortcut-purple" data-target-view="newapp">
     <div class="shortcut-top">
       <div class="shortcut-icon-circle"><span class="shortcut-icon">🚀</span></div>
       <span class="shortcut-pill-badge">ACTIVE</span>
     </div>
     <div class="shortcut-bottom">
       <h2 class="shortcut-title">My New App</h2>
       <span class="shortcut-subtitle">一句话介绍该应用功能</span>
     </div>
   </div>
   ```
3. **在 `main.js` 中挂载初始化**:
   ```javascript
   if (window.NewAppUI) {
     window.NewAppUI.init();
   }
   ```

### 第 3 步：(可选) 增加后端 API 与 D1 数据库表
若该 App 需要云端持久化存储：
1. 在 `migrations/` 创建顺序迁移脚本（如 `0008_create_newapp_table.sql`）。
2. 在 `worker/src/index.js` 中添加针对该 App 的 REST 接口路由（如 `/api/newapp/...`）。
3. 编写对应自动化单元测试于 `tests/`。

---

## 🔒 5. 跨 App 安全与设计守则 (Non-Negotiable)

1. **多租户隔离**: 所有 App 的数据库表必须包含 `user_id` 字段并建立索引，严格按登录用户进行数据隔离。
2. **全屏视图标准**: 子 App 内部的所有二级功能（如数据管理、历史记录、配置弹窗）必须采用全屏视图设计 (`modal-fullscreen`)，严禁制造狭窄弹窗。
3. **零全局污染**: 各 App 的 JS 必须封装在独立 IIFE 或 ES Module 中，仅通过 `window.<AppName>` 暴露必要接口。
