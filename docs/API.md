# REST API Specification (`docs/API.md`)

## Overview
The API is implemented via Cloudflare Worker (`worker/src/index.js`) exposing RESTful JSON endpoints connected to Cloudflare D1 database.

- **Base URL (Local)**: `http://127.0.0.1:8787` (or relative path `/api` via Vite dev server proxy)
- **Base URL (Production)**: `https://hostcalculator-worker.lebin2626.workers.dev`
- **Content-Type**: `application/json`
- **CORS**: Enabled (`Access-Control-Allow-Origin: *`)

---

## Endpoints

### 1. Get All Venues
Retrieves all venue records sorted by ID ascending.

- **Method**: `GET`
- **Endpoint**: `/api/venues`
- **Authentication**: None required
- **Request Parameters**: None

#### Success Response (`200 OK`)
```json
{
  "venues": [
    {
      "id": 1,
      "name": "Sentul Sports Arena",
      "rateMorning": 14.0,
      "rateEvening": 28.0,
      "updatedAt": "2026-08-19 01:00:00"
    }
  ]
}
```

#### Error Response (`500 Internal Server Error`)
```json
{
  "error": "Internal Worker Error: ..."
}
```

---

### 2. Create Venue
Creates a new venue record in the database.

- **Method**: `POST`
- **Endpoint**: `/api/venues`
- **Authentication**: None (Recommended: Admin header token in future)
- **Request Body**:
```json
{
  "name": "Puchong Sports Center",
  "rateMorning": 15.0,
  "rateEvening": 30.0
}
```

#### Field Rules
- `name` (string, required): Non-empty venue title. Must be unique.
- `rateMorning` (number, required): Non-negative number.
- `rateEvening` (number, required): Non-negative number.

#### Success Response (`201 Created`)
```json
{
  "message": "球场添加成功",
  "venue": {
    "id": 2,
    "name": "Puchong Sports Center",
    "rateMorning": 15.0,
    "rateEvening": 30.0
  }
}
```

#### Error Response (`400 Bad Request`)
```json
{
  "error": "球场名称不能为空"
}
```

---

### 3. Update Venue
Updates an existing venue record.

- **Method**: `PUT`
- **Endpoint**: `/api/venues/:id`
- **Path Parameters**: `id` (integer, required) - Venue ID
- **Request Body**:
```json
{
  "name": "Sentul Sports Arena (Renovated)",
  "rateMorning": 16.0,
  "rateEvening": 32.0
}
```

#### Success Response (`200 OK`)
```json
{
  "message": "球场更新成功",
  "venue": {
    "id": 1,
    "name": "Sentul Sports Arena (Renovated)",
    "rateMorning": 16.0,
    "rateEvening": 32.0
  }
}
```

#### Error Response (`404 Not Found`)
```json
{
  "error": "未找到指定球场"
}
```

---

### 4. Delete Venue
Removes a venue record from the database.

- **Method**: `DELETE`
- **Endpoint**: `/api/venues/:id`
- **Path Parameters**: `id` (integer, required) - Venue ID

#### Success Response (`200 OK`)
```json
{
  "message": "球场删除成功",
  "id": 1
}
```

#### Error Response (`404 Not Found`)
```json
{
  "error": "未找到指定球场"
}
```

---

### 5. Get All Saved Bills
Retrieves historical bill calculation records sorted by ID descending.

- **Method**: `GET`
- **Endpoint**: `/api/bills`

#### Success Response (`200 OK`)
```json
{
  "bills": [
    {
      "id": 1,
      "title": "Sentul Sports Arena (08/19)",
      "venueName": "Sentul Sports Arena",
      "playerFee": 15.5,
      "totalPlayers": 8,
      "hostCount": 1,
      "totalCost": 124.0,
      "createdAt": "2026-08-19 10:00:00"
    }
  ]
}
```

---

### 6. Create Saved Bill
Saves a calculation bill snapshot to Cloudflare D1.

- **Method**: `POST`
- **Endpoint**: `/api/bills`
- **Request Body**:
```json
{
  "title": "Sentul Sports Arena AA",
  "venueName": "Sentul Sports Arena",
  "startTime": 16,
  "duration": 2,
  "courtCount": 1,
  "courtFee": 56.0,
  "totalPlayers": 8,
  "hostCount": 1,
  "shuttlesUsed": 4,
  "shuttlePrice": 84.0,
  "additionalShuttles": 0,
  "playerFee": 15.5,
  "totalCost": 84.0,
  "totalRevenue": 108.5,
  "netProfit": 24.5
}
```

#### Success Response (`201 Created`)
```json
{
  "message": "账单保存成功",
  "bill": { "id": 1, "title": "Sentul Sports Arena AA", ... }
}
```

---

### 7. Delete Saved Bill
Removes a bill record from the database.

- **Method**: `DELETE`
- **Endpoint**: `/api/bills/:id`

---

## Auth & Admin System APIs

### 8. User Registration
Registers a new standard user account (`role = 'user'`, `status = 'active'`).

- **Method**: `POST`
- **Endpoint**: `/api/auth/register`
- **Body**: `{ "email": "user@domain.com", "password": "UserPassword123!", "name": "Lebin" }`
- **Response (`201 Created`)**: `{ "message": "注册成功", "user": { ... }, "token": "..." }`

---

### 9. User Login
Authenticates a user or admin account and returns a Bearer Token.

- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Body**: `{ "email": "admin@hostcalculator.com", "password": "AdminPassword123!" }`
- **Response (`200 OK`)**: `{ "message": "登录成功", "user": { "id": 1, "role": "admin", "status": "active" }, "token": "..." }`

---

### 10. User Profile Management
Allows an authenticated user to edit their own username and/or password.

- **Method**: `PATCH`
- **Endpoint**: `/api/auth/profile`
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "name": "NewUsername", "password": "NewSecretPassword123" }`
- **Response (`200 OK`)**: `{ "message": "个人资料已更新", "user": { ... }, "token": "..." }`

---

### 11. Admin Dashboard Analytics
Retrieves total system metrics (Users, Active/Suspended, Admins, Managers, Bills, Profit).

- **Method**: `GET`
- **Endpoint**: `/api/admin/dashboard`
- **Header**: `Authorization: Bearer <token>`
- **Authorization**: Requires `user.role === 'admin' || user.role === 'manager'`. Otherwise returns `403 Forbidden`.

---

### 12. Admin User Management & RBAC Hierarchy
- `POST /api/admin/users`: Directly create a new user account with `allowedApps` permissions (Admin can create `admin`, `manager`, or `user`; Manager can only create `user`).
- `GET /api/admin/users`: List users with search & filters, including `allowedApps` array for each user.
- `GET /api/admin/users/:id`: Get detailed user information including `allowedApps`.
- `GET /api/admin/users/:id/bills`: Get all bills belonging to a specific user.
- `PATCH /api/admin/users/:id`: Update username, email, password, role, status, and `allowedApps` permissions with Audit Log.
- `POST /api/admin/users/:id/suspend`: Freeze user account (Manager cannot freeze Admin/Manager).
- `POST /api/admin/users/:id/activate`: Re-activate user account.
- `DELETE /api/admin/users/:id`: Permanently delete a user account (Manager cannot delete Admin/Manager).
- `GET /api/admin/app-access-stats`: Sub-App access coverage analytics & user access breakdown for each sub-app (`courtledger`, `advancemanager`, `admin`).
- `GET /api/admin/logs`: View admin audit trail.

**Role Hierarchy Levels**:
1. `admin` (超级管理员 Super Admin, Rank 100): Full absolute priority. Can manage all users, managers, system settings, and assign any role & sub-app permissions.
2. `manager` (二级管理员 Manager, Rank 50): Operational admin rights. Can create and manage standard `user` accounts and non-admin sub-apps, view bills/venues, but **strictly cannot modify, freeze, delete, or elevate permissions over `admin` accounts**.
3. `user` (普通用户 Standard User, Rank 10): Standard user functions within authorized sub-apps.

---

## 5. Advance Manager API Endpoints (Sub-App: 垫付管理)

All Advance Manager endpoints require standard Bearer token authentication (`Authorization: Bearer <token>`).

### 1. Dashboard Overview
- **Method**: `GET`
- **Endpoint**: `/api/advancemanager/dashboard`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "mePersonId": "p_me_123",
      "totalAdvanced": 12000,
      "totalSettled": 4000,
      "totalOutstanding": 8000,
      "iOweTotal": 0,
      "netBalance": 8000,
      "peopleWhoOwe": [{ "personId": "p_john", "name": "John", "amount": 8000 }],
      "peopleIOwe": [],
      "recentExpenses": [...],
      "recentSettlements": [...]
    }
  }
  ```

### 2. Expenses CRUD
- `GET /api/advancemanager/expenses`: Query expenses with filters (`search`, `status`, `person_id`, `limit`, `offset`).
- `POST /api/advancemanager/expenses`: Create advance transaction with participants and integer cents.
- `GET /api/advancemanager/expenses/:id`: Get expense details and participant shares.
- `DELETE /api/advancemanager/expenses/:id`: Soft delete/cancel expense (`status = 'cancelled'`).

### 3. Persons & Net Balances
- `GET /api/advancemanager/persons`: List all contacts and calculated Net Balances.
- `POST /api/advancemanager/persons`: Add a new person contact.
- `PUT /api/advancemanager/persons/:id`: Update person or soft archive.
- `GET /api/advancemanager/persons/:id`: Get person detail and historical pairwise ledger.

### 4. Settlements
- `GET /api/advancemanager/settlements`: List settlement history.
- `POST /api/advancemanager/settlements`: Record repayment settlement between two persons.




