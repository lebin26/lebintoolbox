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

### Table: `users`
Stores user authentication credentials, salted PBKDF2 hashes, profile information, and roles.

```text
users
├── id (INTEGER, PK, AUTOINCREMENT)
├── username (TEXT, UNIQUE, NOT NULL)
├── password_hash (TEXT, NOT NULL)
├── salt (TEXT, NOT NULL)
├── role (TEXT, NOT NULL, DEFAULT 'user') -- 'admin' | 'user'
├── status (TEXT, NOT NULL, DEFAULT 'active') -- 'active' | 'disabled'
├── nickname (TEXT, NULLABLE)
├── avatar_url (TEXT, NULLABLE)
├── allowed_apps (TEXT, DEFAULT '["courtledger","financial"]')
├── app_permissions (TEXT, DEFAULT '["courtledger:create_bill","courtledger:delete_bill","financial:manage"]')
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `admin_logs`
Audit log recording critical administrative operations.

```text
admin_logs
├── id (INTEGER, PK, AUTOINCREMENT)
├── admin_id (INTEGER, NOT NULL, FK -> users.id)
├── action (TEXT, NOT NULL)
├── target_user_id (INTEGER, NULLABLE)
├── details (TEXT, NULLABLE)
└── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `bills` (Court Ledger - User Isolated)
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
├── user_id (INTEGER, NULLABLE, FK -> users.id)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `financial_platform_templates` (Public Marketplace)
Stores preset official and community platform templates with logos, categories, and preset product definitions.

```text
financial_platform_templates
├── id (INTEGER, PK, AUTOINCREMENT)
├── name (TEXT, NOT NULL)
├── category (TEXT, NOT NULL, DEFAULT 'Banking') -- 'Banking', 'Investment', 'E-Wallet', 'Crypto', 'Pension', 'Forex', 'Cash'
├── logo_url (TEXT, NULLABLE)
├── description (TEXT, NULLABLE)
├── default_currency (TEXT, NOT NULL, DEFAULT 'MYR')
├── preset_products_json (TEXT, NOT NULL, DEFAULT '[]')
├── is_official (INTEGER, NOT NULL, DEFAULT 1)
├── usage_count (INTEGER, NOT NULL, DEFAULT 0)
├── created_by (INTEGER, NULLABLE, FK -> users.id)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `financial_platforms` (Financial Overview - User Isolated)
Stores user-specific financial institutions and brokerage platforms.

```text
financial_platforms
├── id (INTEGER, PK, AUTOINCREMENT)
├── name (TEXT, NOT NULL)
├── logo_url (TEXT, NULLABLE)
├── description (TEXT, NULLABLE)
├── is_active (INTEGER, NOT NULL, DEFAULT 1)
├── sort_order (INTEGER, NOT NULL, DEFAULT 0)
├── user_id (INTEGER, NULLABLE, FK -> users.id)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `financial_products` (Financial Overview - User Isolated)
Stores user-specific financial products and sub-accounts under a platform.

```text
financial_products
├── id (INTEGER, PK, AUTOINCREMENT)
├── platform_id (INTEGER, NOT NULL, FK -> financial_platforms.id)
├── name (TEXT, NOT NULL)
├── product_type (TEXT, NOT NULL, DEFAULT 'Savings')
├── currency (TEXT, NOT NULL, DEFAULT 'MYR')
├── logo_url (TEXT, NULLABLE)
├── target_allocation_pct (REAL, NOT NULL, DEFAULT 0.0)
├── is_active (INTEGER, NOT NULL, DEFAULT 1)
├── sort_order (INTEGER, NOT NULL, DEFAULT 0)
├── notes (TEXT, NULLABLE)
├── user_id (INTEGER, NULLABLE, FK -> users.id)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `financial_periods` (Financial Overview - User Isolated)
Tracks the status and notes of each monthly reporting period per user.

```text
financial_periods
├── id (INTEGER, PK, AUTOINCREMENT)
├── month_key (TEXT, NOT NULL)
├── status (TEXT, NOT NULL, DEFAULT 'draft') -- 'draft', 'saved', 'locked'
├── notes (TEXT, NULLABLE)
├── user_id (INTEGER, NULLABLE, FK -> users.id)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```

---

### Table: `financial_snapshots` (Financial Overview)
Stores native amount, FX rate to base, and converted base amount per product in a period.

```text
financial_snapshots
├── id (INTEGER, PK, AUTOINCREMENT)
├── period_id (INTEGER, NOT NULL, FK -> financial_periods.id)
├── product_id (INTEGER, NOT NULL, FK -> financial_products.id)
├── native_amount (REAL, NOT NULL, DEFAULT 0.0)
├── currency (TEXT, NOT NULL, DEFAULT 'MYR')
├── fx_rate_to_base (REAL, NOT NULL, DEFAULT 1.0)
├── base_amount (REAL, NOT NULL, DEFAULT 0.0)
├── notes (TEXT, NULLABLE)
├── created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
└── updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
```
