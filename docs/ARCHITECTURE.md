# OmniBox Architecture Documentation (`docs/ARCHITECTURE.md`)

## 1. Project Overview & Positioning
**OmniBox** is a lightweight, zero-build, modular multi-app productivity platform designed to host utility tools with instant access, responsive dark/light theme support, and offline-first data resilience.

- **Platform Container**: **OmniBox Hub**
- **Sub-App #1**: **Court Ledger** (🏸 羽毛球活动 AA 场费测算、用球平摊、球场数据管理与历史账单)
- **Sub-App #2**: **Financial Overview** (💰 月度财务总览、资产配置、多币种换算与跨月走势对比矩阵)

---

## 2. Technical Stack

| Tier | Technology / Service | Role & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5, Vanilla CSS, ES6 Modules | Zero-build single-page web app, DOM state controllers, Canvas charts |
| **API Layer** | Cloudflare Worker (`worker/src/index.js`, `financial.js`) | Serverless API routing, CORS handling, D1 database execution, and Workers Assets static hosting |
| **Database** | Cloudflare D1 (SQLite Engine) | Serverless relational DB storing venues, bills, platforms, products, and monthly snapshots |
| **Hosting** | Cloudflare Workers Assets / Pages | Global edge static file and API serving |

---

## 3. Data Flow Architecture

```text
+-----------------------------------+
|         Frontend User UI          |
| (Vanilla JS + LocalStorage Hybrid)|
+-----------------+-----------------+
                  |
        HTTP Fetch Request (/api/...)
                  |
                  v
+-----------------------------------+
|         Cloudflare Worker         |
|       (worker/src/index.js)       |
+-----------------+-----------------+
                  |
             env.DB (D1)
                  |
                  v
+-----------------------------------+
|           Cloudflare D1           |
|        (SQLite SQL Engine)        |
+-----------------------------------+
```

### Local Development Flow:
- Run `npm run dev` (starts `wrangler dev` inside `worker/`).
- Serves both frontend static assets and `/api/*` on `http://127.0.0.1:8787` seamlessly without CORS or proxy friction.

---

## 4. Environment & Database Isolation

| Environment | Frontend URL | Worker API | Database |
| :--- | :--- | :--- | :--- |
| **Local (Dev)** | `http://127.0.0.1:8787` | `http://127.0.0.1:8787` | Local SQLite in `.wrangler/state/v3/d1/` |
| **Production** | Cloudflare Pages / Workers URL | Cloudflare Workers Edge | Cloudflare D1 (`host-calculator-db`) |
