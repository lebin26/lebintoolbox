# REST API Specification (`docs/API.md`)

## Overview
The API is implemented via Cloudflare Worker (`worker/src/index.js`, `worker/src/auth.js`, `worker/src/financial.js`) exposing RESTful JSON endpoints connected to Cloudflare D1 database.

- **Base URL (Local)**: `http://127.0.0.1:8787`
- **Base URL (Production)**: `https://hostcalculator-worker.lebin2626.workers.dev`
- **Content-Type**: `application/json`
- **CORS**: Enabled (`Access-Control-Allow-Origin: *`)
- **Authentication**: JWT Bearer Token in `Authorization: Bearer <token>` header

---

## 1. Authentication & User Management API

### 1.1 Register New Account
- **Method**: `POST`
- **Endpoint**: `/api/auth/register`
- **Body**: `{ "username": "alice", "password": "password123", "nickname": "爱丽丝" }`
- **Response**: `{ "message": "...", "user": { "id": 1, "username": "alice", "role": "admin", ... }, "token": "eyJhbGci..." }`

### 1.2 User Login
- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Body**: `{ "username": "alice", "password": "password123" }`
- **Response**: `{ "message": "登录成功", "user": { ... }, "token": "eyJhbGci..." }`

### 1.3 Current User Info
- **Method**: `GET`
- **Endpoint**: `/api/auth/me`
- **Response**: `{ "authenticated": true, "user": { "id": 1, "username": "alice", "role": "admin", "nickname": "...", "avatarUrl": "..." } }`

### 1.4 Update Profile & Password
- **Method**: `PUT`
- **Endpoint**: `/api/auth/profile`
- **Body**: `{ "nickname": "新昵称", "avatarUrl": "https://...", "oldPassword": "...", "newPassword": "..." }`

### 1.5 Admin Users Management (Admin Role Only)
- `GET /api/admin/users`: List all registered users.
- `PUT /api/admin/users/:id`: Modify user role, status (active/disabled), permissions, or reset password.
- `GET /api/admin/logs`: View administrative action audit logs.

---

## 2. Court Ledger API Endpoints (User Isolated)

### 2.1 Venues (Public / Shared)
- `GET /api/venues`: Get all venues.
- `POST /api/venues`: Create venue `{ name, rateMorning, rateEvening }`.
- `PUT /api/venues/:id`: Update venue.
- `DELETE /api/venues/:id`: Delete venue.

### 2.2 Bills (User Isolated)
- `GET /api/bills`: Get current user's bills (Admin can append `?all=true`).
- `POST /api/bills`: Create bill snapshot (bound to `user_id`).
- `PUT /api/bills/:id`: Update bill (authorized for bill owner or admin).
- `DELETE /api/bills/:id`: Delete bill.

---

## 3. Monthly Financial Overview API Endpoints (User Isolated)

### 3.1 Template Preset Library (Public Marketplace)
- `GET /api/financial/templates?category=&search=`: Query official & community platform templates.
- `POST /api/financial/templates/apply`: 1-Click clone a template and its preset products into user's account `{ templateId }`.
- `POST /api/financial/templates/publish`: Publish a user's platform to the template marketplace `{ platformId, category, description }`.

### 3.2 Platforms CRUD (User Isolated)
- `GET /api/financial/platforms`: Get user's platforms with product counts.
- `POST /api/financial/platforms`: Create new platform `{ name, logoUrl, description, sortOrder }`.
- `PUT /api/financial/platforms/:id`: Update platform.
- `DELETE /api/financial/platforms/:id`: Delete or deactivate platform.

### 3.3 Products CRUD (User Isolated)
- `GET /api/financial/products?platformId=`: Get user's products.
- `POST /api/financial/products`: Create product `{ platformId, name, productType, currency, targetAllocationPct, sortOrder, notes }`.
- `PUT /api/financial/products/:id`: Update product.
- `DELETE /api/financial/products/:id`: Delete or deactivate product.

### 3.4 Monthly Snapshots Entry & Batch Save (User Isolated)
- `GET /api/financial/months/:month`: Get input items with previous month references for current user.
- `POST /api/financial/months/:month`: Save monthly snapshots `{ snapshots: [...], notes, status }`.
- `POST /api/financial/months/:month/copy-previous`: One-click copy previous month snapshots.

### 3.5 Dashboard & Multi-Month Analytics (User Isolated)
- `GET /api/financial/dashboard?month=YYYY-MM`: Get net worth KPI, platform/product allocation, currency exposure, MoM change, and 12-month asset curve.
- `GET /api/financial/analytics?limit=6`: Get multi-month cross comparison matrix grouped by platform and product.

### 3.6 Backup & Migration (User Isolated)
- `GET /api/financial/backup/export`: Export user's complete platforms, products, periods, and snapshots as JSON.
- `POST /api/financial/backup/import`: Import JSON backup into user's account.
