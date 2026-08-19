# Project Architecture Documentation (`docs/ARCHITECTURE.md`)

## 1. Project Overview
**HostCalculator (羽毛球 AA 算账与实用工具箱)** is a web application designed for badminton activity hosts to calculate venue court fees, shuttlecock costs, and individual AA expense shares.

---

## 2. Technical Stack

| Tier | Technology / Service | Role & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5, Vanilla CSS, ES6 JS (Modules), Vite | User Interface, local dev server with HMR, client-side calculation & state management |
| **API Layer** | Cloudflare Worker | Serverless API routing, CORS handling, data validation |
| **Database** | Cloudflare D1 (SQLite Engine) | Serverless relational DB storing venue names and morning/evening rates |
| **Hosting (FE)** | GitHub Pages | Static web hosting for frontend application |
| **Hosting (API)** | Cloudflare Workers Edge Network | Global low-latency API execution |
| **Build & Deploy** | Cloudflare Workers Builds + GitHub Pages CI | Automated GitHub `push` deployment |

---

## 3. Data Flow Architecture

```text
+-----------------------+
|   Frontend User UI    |
| (GitHub Pages / Vite) |
+-----------+-----------+
            |
     HTTP Fetch Request (/api/venues)
            |
            v
+-----------------------+
|   Cloudflare Worker   |
|   (worker/src/index.js)
+-----------+-----------+
            |
      env.DB (D1 SQL)
            |
            v
+-----------------------+
|    Cloudflare D1      |
|  (SQLite SQL Database)|
+-----------------------+
```

### Local Development Flow:
- Frontend running at `http://localhost:8000` via `vite`.
- Vite proxies `/api/*` to `http://127.0.0.1:8787` (Wrangler local worker).
- Worker executes against local isolated SQLite database inside `.wrangler/state/v3/d1/`.

### Production Deployment Flow:
- Frontend hosted at GitHub Pages (or custom domain).
- Frontend queries Cloudflare Worker API at `https://hostcalculator-worker.<subdomain>.workers.dev/api/venues`.
- Worker executes queries on Cloudflare D1 Remote Database (`host-calculator-db`).

---

## 4. Authentication & Authorization (Unified User & Admin RBAC)

- **Single Account Architecture**: All users use one unified account system (`users` table).
- **Role Control**:
  - `role = 'user'`: Accesses normal app features (Hub, CourtLedger, HistoryBills).
  - `role = 'admin'`: Accesses 100% of normal user features **plus** `/admin` Admin Dashboard (`#view-admin`).
- **Backend Enforcement**: Cloudflare Worker performs strict token authentication (`/api/auth/*`) and server-side RBAC authorization (`requireAdmin` middleware) returning `403 Forbidden` for unauthorized requests to `/api/admin/*`.
- **Audit Logs**: All admin actions (role changes, user suspensions, activations) are logged to `admin_logs`.
- **Sole Admin Safeguard**: System enforces `COUNT(active_admins) > 1` to prevent accidental removal or suspension of the sole active administrator.

---

## 5. Environment & Database Isolation

| Environment | Frontend URL | Worker API | Database |
| :--- | :--- | :--- | :--- |
| **Local (Dev)** | `http://localhost:8000` | `http://127.0.0.1:8787` | Local SQLite in `.wrangler/state/v3/d1/` |
| **Production** | GitHub Pages URL | Cloudflare Workers Edge | Cloudflare D1 (`f4d383d8-ffa7-463e-87b0-088a3dbc7f79`) |

> **Critical Rule**: AI Agents & Developers MUST default to working in the `Local` environment. Direct schema modifications or manual deletions on `Production` database are strictly prohibited.

---

## 6. Deployment & CI/CD Pipeline

```text
Local Code Editing & Testing
         |
    git commit & git push
         |
         +---------------------------------------+
         |                                       |
  GitHub Repository                     GitHub Pages Deployment
         |                                 (Frontend static asset update)
         v
Cloudflare Workers Builds
 (Triggers `npx wrangler deploy` inside `worker/`)
         |
         v
Cloudflare Workers Production Edge
```

---

## 7. Critical Constraints & Preservation Directives

1. **Do NOT delete or rewrite existing UI features** (`courtledger.html`, `hub.html`, court fee calculations, shuttlecock share calculations, QR code renderer, bill exporter).
2. **Do NOT alter executed migration files** in `migrations/`. Always append new migrations sequentially (e.g., `0002_xxx.sql`).
3. **Do NOT expose secrets or credentials** in Git commits (`.env`, Cloudflare tokens, admin keys).
4. **Preserve CORS preflight handling** in `worker/src/index.js`.
5. **Full-Screen Sub-Window Standard**: Every feature screen or sub-window entered via button clicks (such as History Bills, Database Dashboards, or Complex Tools) MUST be designed as a full-screen standalone page/view (`.modal-fullscreen`). Do not manufacture tiny or narrow pop-up dialog boxes. Ensure touch scroll isolation (`body.modal-open`) and prevent background page swipe leaks.
