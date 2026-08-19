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
├── role (TEXT, DEFAULT 'user') -- 'user' | 'admin'
├── status (TEXT, DEFAULT 'active') -- 'active' | 'suspended' | 'deleted'
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
