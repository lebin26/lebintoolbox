# OmniBox - 多功能应用聚合平台 (Multi-App Platform)

**OmniBox** 是一款轻量、现代、模块化的高性能应用与效率工具聚合平台。

- 🌐 **平台底座 (Platform Core)**：内置统一单点登录鉴权 (RBAC)、全局外观引擎、全屏单页路由调度器及系统管理控制台。
- 🏸 **当前旗舰子应用 (Active App)**：**Court Ledger** —— 为羽毛球活动组织者量身打造的智能 AA 场费分段计算、用球平摊与历史账单管理工具。

全栈基于 **Serverless 零成本架构** 构建：
- **前端网页 (`frontend/`)**：托管于 GitHub Pages / Cloudflare Pages (Vanilla JS + Vite)
- **API 后端 (`worker/`)**：Cloudflare Worker，配合 **Workers Builds** 实现 GitHub 提交代码一键自动部署
- **数据库 (`migrations/`)**：Cloudflare D1 无服务器 SQLite 数据库

---

## 🌳 项目树结构 (OmniBox Project Tree)

详细的项目目录分层规范与新增子 App 指南可查阅 [`docs/PROJECT_TREE.md`](docs/PROJECT_TREE.md)。

```text
OmniBox/
├── docs/                              # [文档中心] 架构规范、API、数据库与开发指南
│   ├── ARCHITECTURE.md                # OmniBox 整体全栈架构设计规范
│   ├── PROJECT_TREE.md                # OmniBox 完整项目树与多 App 扩展 SOP
│   ├── API.md                         # Cloudflare Worker REST API 接口文档
│   └── DATABASE.md                    # Cloudflare D1 数据库设计与字段字典
├── frontend/                          # [前端层] 现代极简 SPA (Vanilla JS + Vite)
│   ├── index.html                     # 平台统一 HTML 骨架与全屏模态窗口
│   ├── app.js                         # 前端入口代理
│   ├── start.sh                       # 本地热更新全栈开发一键启动脚本
│   ├── assets/                        # 全局共享静态资源 (图标、二维码等)
│   ├── css/                           # [样式分层体系]
│   │   ├── variables.css              # 全局设计 Tokens (调色板、圆角、字阶)
│   │   ├── base.css                   # 全局重置、排版、全屏 Modal 规范
│   │   ├── hub.css                    # OmniBox Hub 主页 (应用网格、登录、Admin后台)
│   │   └── courtledger.css            # [App: Court Ledger] 专属卡片与算账样式
│   ├── views/                         # [HTML 视图碎片]
│   │   ├── hub.html                   # OmniBox 首页应用网格 (App Launcher)
│   │   └── courtledger.html           # [App: Court Ledger] 算账主界面与历史账单
│   └── js/                            # [JavaScript 模块化业务逻辑]
│       ├── main.js                    # OmniBox 全局生命周期与子系统引导入口
│       ├── core/                      # 平台全局核心底座 (Auth, Router, Theme, Drawer)
│       ├── admin/                     # 平台全局管理控制台 (Admin Console, RBAC)
│       └── courtledger/               # [App: Court Ledger] 专属业务域 (Calculator, State, UI, Bill, QR)
├── worker/                            # [后端 API 层] Cloudflare Worker Serverless API
│   ├── src/
│   │   └── index.js                   # 统一 API 路由分发、RBAC 中间件与 D1 操作
│   ├── package.json                   # Worker 依赖配置
│   └── wrangler.jsonc                 # Cloudflare Worker & D1 数据库绑定配置
├── migrations/                        # [数据库层] Cloudflare D1 数据库版本化迁移脚本
└── tests/                             # [自动化测试套件] 接口验证、计算引擎数学与 E2E 测试
```

---

## 🛡️ 本地开发隔离与数据同步指南

本应用内置了智能环境识别，保证本地调试与线上生产环境 100% 物理隔离：

| 操作目的 | 场景与运行环境 | 数据存储位置 | 说明与命令 |
| :--- | :--- | :--- | :--- |
| **本地开发测试** | 访问 `http://localhost:8000` | 电脑本地 `.wrangler/` 隔离数据库 | 运行 `npm run dev` 或 `./frontend/start.sh`<br>（支持前端 HMR 样式热重载与全栈热重载，增删测试数据不影响线上） |
| **同步更新线上表结构** | 更新了 `migrations/` 的 SQL | Cloudflare 线上 D1 云端数据库 | 终端运行 `npm run d1:migrate` |
| **同步本地数据至线上** | 将本地测试数据推送到线上 | Cloudflare 线上 D1 云端数据库 | 终端运行 `npm run d1:sync:data` |
| **更新线上真实球场数据** | 访问正式线上网站 | Cloudflare 线上 D1 云端数据库 | 直接在线上网页的【Court Ledger 设置 -> 🏸 球场数据库管理】中在线添加/修改/删除 |

---

## ⚙️ 快速配置与部署教程

### 第一步：创建 Cloudflare D1 数据库并进行初始迁移

1. 打开终端，进入 `worker` 目录并安装依赖：
   ```bash
   cd worker
   npm install
   ```

2. 登录 Cloudflare（若首次使用）：
   ```bash
   npx wrangler login
   ```

3. 创建 D1 数据库实例：
   ```bash
   npx wrangler d1 create host-calculator-db
   ```
   *控制台会输出一个 `database_id`，将其复制并替换粘贴到 `worker/wrangler.jsonc` 中的 `"database_id"` 字段。*

4. 执行数据库结构与种子数据迁移：
   ```bash
   npx wrangler d1 execute host-calculator-db --remote --file=../migrations/0001_create_venues.sql
   ```

---

### 第二步：首次部署 Worker (通过 Wrangler)

在 `worker` 目录下运行一次本地部署，确认 Worker 正常上线：
```bash
npx wrangler deploy
```
*发布成功后，控制台会返回您的 Worker API 网址，例如：`https://omnibox-worker.<your-name>.workers.dev`*

---

### 第三步：在 Cloudflare 控制台关联 GitHub (Workers Builds 自动部署)

使用 Cloudflare 官方推崇的 **Workers Builds** 无缝关联 GitHub，以后只需 `git push` 即可自动构建发布：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 导航至 **Workers & Pages** -> 选择创建的 Worker。
3. 点击 **Settings** -> **Builds** -> **Git Repository** -> 点击 **Connect GitHub**。
4. 选择您的 GitHub 仓库以及主分支 `main`。
5. 配置构建参数（Build Configuration）：
   - **Root directory**: `worker`
   - **Deploy command**: `npx wrangler deploy`
   - **Build command**: *(留空即可)*
6. 点击 **Save and Deploy** 保存配置。

> 提示：以后只要对 `worker/src/index.js` 修改并 `git push`，Cloudflare Workers Builds 就会自动拉取代码部署，无需在本地执行任何 `wrangler deploy`！

---

### 第四步：托管前端到 GitHub Pages / Cloudflare Pages

1. 进入 GitHub 仓库 -> **Settings** -> **Pages**。
2. Source 选择 `Deploy from a branch`，Branch 选择 `main` / `/frontend`。
3. *(可选)* 若 Worker 域名与前端不同源，可将 Worker API 域名配置在前端 `window.WORKER_API_URL` 变量中，或设置 Cloudflare 域名 Routes 规则。
