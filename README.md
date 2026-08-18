# HostCalculator - 羽毛球 AA 算账与实用工具箱

HostCalculator 是一款为羽毛球活动组织者 (Host) 量身打造的智能 AA 场费与用球平摊计算工具。

全栈基于 **Serverless 零成本架构** 构建：
- **前端网页 (`frontend/`)**：托管于 GitHub Pages
- **API 后端 (`worker/`)**：Cloudflare Worker，配合 **Workers Builds** 实现 GitHub 提交代码一键自动部署
- **数据库 (`migrations/`)**：Cloudflare D1 无服务器 SQLite 数据库

---

## 目录结构 (Monorepo)

```text
HostCalculator/
├── frontend/                     # 前端静态 Web 应用 (GitHub Pages)
│   ├── index.html                # 主页面入口
│   ├── app.js                    # 主逻辑入口
│   ├── venues.csv                # CSV 本地备份/离线 Fallback
│   ├── start.sh                  # 本地测试启动脚本
│   ├── assets/                   # 图标与二维码
│   ├── views/                    # View 视图模板 (算账主页与工具箱)
│   ├── css/                      # 极简 UI 样式表
│   └── js/                       # 前端 ES6 业务与 API 模块
├── worker/                       # Cloudflare Worker 后端 API 服务
│   ├── src/
│   │   └── index.js              # Worker API (REST endpoints /api/venues)
│   ├── package.json              # Worker 项目配置
│   └── wrangler.jsonc            # Cloudflare Worker & D1 绑定配置
└── migrations/                   # Cloudflare D1 数据库迁移 SQL 文件
    └── 0001_create_venues.sql    # 建表与初始球场种子数据
```

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
*发布成功后，控制台会返回您的 Worker API 网址，例如：`https://hostcalculator-worker.<your-name>.workers.dev`*

---

### 第三步：在 Cloudflare 控制台关联 GitHub (Workers Builds 自动部署)

使用 Cloudflare 官方推崇的 **Workers Builds** 无缝关联 GitHub，以后只需 `git push` 即可自动构建发布：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 导航至 **Workers & Pages** -> 选择刚才创建的 `hostcalculator-worker`。
3. 点击 **Settings** -> **Builds** -> **Git Repository** -> 点击 **Connect GitHub**。
4. 选择您的 GitHub 仓库 `HostCalculator` 以及主分支 `main`。
5. 配置构建参数（Build Configuration）：
   - **Root directory**: `worker`
   - **Deploy command**: `npx wrangler deploy`
   - **Build command**: *(留空即可)*
6. 点击 **Save and Deploy** 保存配置。

> 提示：以后只要对 `worker/src/index.js` 修改并 `git push`，Cloudflare Workers Builds 就会自动拉取代码部署，无需在本地执行任何 `wrangler deploy`！

---

### 第四步：托管前端到 GitHub Pages

1. 进入 GitHub 仓库 -> **Settings** -> **Pages**。
2. Source 选择 `Deploy from a branch`，Branch 选择 `main` / `/frontend`（或将前端输出为 Pages 站点）。
3. *(可选)* 若 Worker 域名与前端不同源，可将 Worker API 域名配置在前端 `window.WORKER_API_URL` 变量中，或设置 Cloudflare 域名 Routes 规则。

---

## REST API 接口规范

- `GET /api/venues` - 获取 D1 数据库中的球场列表
- `POST /api/venues` - 新增球场 `{"name": "...", "rateMorning": 14, "rateEvening": 28}`
- `PUT /api/venues/:id` - 更新指定球场价格与名称
- `DELETE /api/venues/:id` - 从 D1 数据库删除指定球场
