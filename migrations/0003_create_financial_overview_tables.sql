-- Migration 0014: Create Monthly Financial Overview (Sub-App #2) tables
-- Platforms -> Products -> Periods -> Monthly Snapshots

CREATE TABLE IF NOT EXISTS financial_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'Savings',
  currency TEXT NOT NULL DEFAULT 'MYR',
  logo_url TEXT,
  target_allocation_pct REAL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_id) REFERENCES financial_platforms(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS financial_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  native_amount REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'MYR',
  fx_rate_to_base REAL NOT NULL DEFAULT 1.0,
  base_amount REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, product_id),
  FOREIGN KEY (period_id) REFERENCES financial_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES financial_products(id) ON DELETE RESTRICT
);

-- Performance Indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_financial_products_platform_id ON financial_products(platform_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_month_key ON financial_periods(month_key);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_period_id ON financial_snapshots(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_product_id ON financial_snapshots(product_id);
