# Database Documentation (`docs/DATABASE.md`)

## 1. Database Specifications

| Attribute | Details |
| :--- | :--- |
| **Engine** | Cloudflare D1 (Serverless SQLite engine) |
| **Database Name** | `host-calculator-db` |
| **Database ID (Production)** | `f4d383d8-ffa7-463e-87b0-088a3dbc7f79` |
| **Migration Directory** | `migrations/` |
| **Binding Name in Worker** | `env.DB` |

---

## 2. Table Schemas

### Table: `venues`
Stores badminton venues along with their hourly pricing tiers (morning / peak-evening).

```text
venues
├── id (INTEGER, PK, AUTOINCREMENT)
├── name (TEXT, NOT NULL, UNIQUE)
├── rate_morning (REAL, NOT NULL, DEFAULT 0.0)
├── rate_evening (REAL, NOT NULL, DEFAULT 0.0)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

#### Detailed Column Attributes

| Column Name | Data Type | Nullable | Primary Key | Unique | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INTEGER | NO | YES | YES | AUTOINCREMENT | Primary auto-incrementing surrogate key |
| `name` | TEXT | NO | NO | YES | N/A | Unique venue title (e.g. `Sentul Sports Arena`) |
| `rate_morning` | REAL | NO | NO | NO | `0.0` | Non-peak / morning hourly rate |
| `rate_evening` | REAL | NO | NO | NO | `0.0` | Peak / evening hourly rate |
| `created_at` | DATETIME | YES | NO | NO | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | DATETIME | YES | NO | NO | `CURRENT_TIMESTAMP` | Last record update timestamp |

---

### Table: `bills`
Stores historical AA calculation bill snapshots for traceback and record editing.

```text
bills
├── id (INTEGER, PK, AUTOINCREMENT)
├── title (TEXT, NOT NULL)
├── venue_name (TEXT, NOT NULL)
├── start_time (INTEGER, NOT NULL, DEFAULT 16)
├── duration (INTEGER, NOT NULL, DEFAULT 2)
├── court_count (INTEGER, NOT NULL, DEFAULT 1)
├── court_fee (REAL, NOT NULL, DEFAULT 0.0)
├── total_players (INTEGER, NOT NULL, DEFAULT 6)
├── host_count (INTEGER, NOT NULL, DEFAULT 0)
├── shuttles_used (INTEGER, NOT NULL, DEFAULT 3)
├── shuttle_price (REAL, NOT NULL, DEFAULT 123.0)
├── additional_shuttles (INTEGER, NOT NULL, DEFAULT 0)
├── player_fee (REAL, NOT NULL, DEFAULT 0.0)
├── total_cost (REAL, NOT NULL, DEFAULT 0.0)
├── total_revenue (REAL, NOT NULL, DEFAULT 0.0)
├── net_profit (REAL, NOT NULL, DEFAULT 0.0)
├── user_id (INTEGER, NULLABLE)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `users`
Stores user accounts for unified authentication & RBAC system.

```text
users
├── id (INTEGER, PK, AUTOINCREMENT)
├── email (TEXT, UNIQUE, NOT NULL)
├── password_hash (TEXT, NOT NULL)
├── plain_password (TEXT, NULLABLE) -- Plaintext password visible only to Administrator for support
├── name (TEXT, NOT NULL)
├── avatar (TEXT, NULLABLE)
├── role (TEXT, DEFAULT 'user') -- 'user' | 'manager' | 'admin'
├── status (TEXT, DEFAULT 'active') -- 'active' | 'suspended' | 'deleted'
├── allowed_apps (TEXT, DEFAULT '["courtledger","advancemanager"]') -- JSON Array of permitted sub-apps
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
├── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── last_login_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `admin_logs`
Stores audit trail records for all administrative actions performed by Admins.

```text
admin_logs
├── id (INTEGER, PK, AUTOINCREMENT)
├── admin_user_id (INTEGER, NOT NULL)
├── admin_name (TEXT, NOT NULL)
├── action (TEXT, NOT NULL)
├── target_type (TEXT, NULLABLE)
├── target_id (TEXT, NULLABLE)
├── details (TEXT, NULLABLE)
└── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

## 3. Local SQLite GUI Inspection Guide

During local development (`npm run dev`), Wrangler automatically manages a local SQLite file using Miniflare.

### Locating the Local `.sqlite` File
- **Path**: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`
- **GUI Tool Compatibility**:
  - **DB Browser for SQLite**: Open file directly from the `.wrangler` path above.
  - **Beekeeper Studio**: Select SQLite connection driver and point to the `.sqlite` file.
  - **VS Code SQLite Extension** (alexcvzz.vscode-sqlite): Open Command Palette -> `SQLite: Open Database` -> select local `.sqlite` file.
  - **SQLiteStudio**: Drag & drop the `.sqlite` file into SQLiteStudio.

---

### Table: `am_persons` (Advance Manager - 涉及人物)
Stores contacts/persons involved in debt and advance transactions (isolated by `owner_user_id`).

| Column | Type | Nullable | Primary Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | TEXT | NO | YES | Person UUID |
| `owner_user_id` | TEXT | NO | NO | Owner user account ID |
| `name` | TEXT | NO | NO | Person real name / display name |
| `nickname` | TEXT | YES | NO | Optional nickname |
| `phone` | TEXT | YES | NO | Phone number |
| `email` | TEXT | YES | NO | Email address |
| `avatar_url` | TEXT | YES | NO | Avatar URL |
| `note` | TEXT | YES | NO | Relationship note |
| `is_archived` | INTEGER | NO | NO | Soft archive flag (0/1) |
| `created_at` | TEXT | NO | NO | ISO 8601 creation time |
| `updated_at` | TEXT | NO | NO | ISO 8601 update time |

---

### Table: `am_expenses` (Advance Manager - 垫付主表)
Stores main expense transaction details. All amounts stored as integer cents.

| Column | Type | Nullable | Primary Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | TEXT | NO | YES | Expense UUID |
| `owner_user_id` | TEXT | NO | NO | Owner user ID |
| `transaction_date` | TEXT | NO | NO | Date/time of expense (ISO 8601) |
| `description` | TEXT | NO | NO | Purpose / title of advance |
| `total_amount` | INTEGER | NO | NO | Amount in minimum cents (e.g. 1250 = RM 12.50) |
| `currency` | TEXT | NO | NO | Currency code (default `MYR`) |
| `payer_person_id` | TEXT | NO | NO | FK to `am_persons.id` |
| `category_id` | TEXT | YES | NO | FK to `am_categories.id` |
| `project_id` | TEXT | YES | NO | FK to `am_projects.id` |
| `payment_method` | TEXT | NO | NO | Payment method |
| `status` | TEXT | NO | NO | Status (`unsettled`, `partial`, `settled`, `cancelled`) |
| `note` | TEXT | YES | NO | Notes |
| `created_at` | TEXT | NO | NO | Creation time |
| `updated_at` | TEXT | NO | NO | Update time |

---

### Table: `am_expense_participants` (Advance Manager - 分摊明细)
Stores individual split liability for each person per expense.

| Column | Type | Nullable | Primary Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | TEXT | NO | YES | Participant record UUID |
| `expense_id` | TEXT | NO | NO | FK to `am_expenses.id` |
| `person_id` | TEXT | NO | NO | FK to `am_persons.id` |
| `split_type` | TEXT | NO | NO | `equal`, `fixed`, `percentage` |
| `share_amount` | INTEGER | NO | NO | Liability in cents |
| `percentage` | REAL | YES | NO | Percentage if split_type = percentage |
| `created_at` | TEXT | NO | NO | Creation timestamp |
| `updated_at` | TEXT | NO | NO | Update timestamp |

---

### Table: `am_settlements` (Advance Manager - 还款平账结算)
Records direct repayment transactions between two persons.

| Column | Type | Nullable | Primary Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | TEXT | NO | YES | Settlement UUID |
| `owner_user_id` | TEXT | NO | NO | Owner user ID |
| `from_person_id` | TEXT | NO | NO | Debtor paying back (`am_persons.id`) |
| `to_person_id` | TEXT | NO | NO | Creditor receiving (`am_persons.id`) |
| `amount` | INTEGER | NO | NO | Repayment amount in cents |
| `currency` | TEXT | NO | NO | Currency code (default `MYR`) |
| `settlement_date` | TEXT | NO | NO | Settlement date/time (ISO 8601) |
| `payment_method` | TEXT | NO | NO | Method of payment |
| `note` | TEXT | YES | NO | Settlement remarks |
| `created_at` | TEXT | NO | NO | Creation timestamp |
| `updated_at` | TEXT | NO | NO | Update timestamp |

---

## 4. Migration Rules & Process

1. **Immutable Migrations**: Never modify an existing, applied migration file (such as `migrations/0001_create_venues.sql`).
2. **Sequential Naming**: Create new migrations using zero-padded prefixes (e.g., `0002_add_venue_address.sql`).
3. **Local Testing**: Always test migrations locally before applying to production:
   ```bash
   # Apply migration locally
   npm run d1:migrate:local
   ```
4. **Production Execution**:
   ```bash
   # Apply migration to remote Cloudflare D1
   npm run d1:migrate
   ```

---

## 5. Backup & Disaster Recovery Strategy

### Local Backup
- Direct export of local state:
  ```bash
  cd worker && npx wrangler d1 export host-calculator-db --local --output=../backups/local_backup.sql
  ```

### Production Backup
- Export remote Cloudflare D1 schema & data:
  ```bash
  cd worker && npx wrangler d1 export host-calculator-db --remote --output=../backups/prod_backup_$(date +%Y%m%d).sql
  ```

### Pull Remote Data to Local
- Pull remote production snapshot to local development database:
  ```bash
  npm run d1:pull
  ```

### Recovery Procedure
- In case of emergency or data corruption, restore from SQL dump:
  ```bash
  cd worker && npx wrangler d1 execute host-calculator-db --remote --file=../backups/prod_backup_YYYYMMDD.sql
  ```
