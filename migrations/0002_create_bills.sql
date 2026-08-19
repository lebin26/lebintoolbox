-- Cloudflare D1 Migration: Create bills table for AA ledger history tracking

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  start_time INTEGER NOT NULL DEFAULT 16,
  duration INTEGER NOT NULL DEFAULT 2,
  court_count INTEGER NOT NULL DEFAULT 1,
  court_fee REAL NOT NULL DEFAULT 0.0,
  total_players INTEGER NOT NULL DEFAULT 6,
  host_count INTEGER NOT NULL DEFAULT 0,
  shuttles_used INTEGER NOT NULL DEFAULT 3,
  shuttle_price REAL NOT NULL DEFAULT 123.0,
  additional_shuttles INTEGER NOT NULL DEFAULT 0,
  player_fee REAL NOT NULL DEFAULT 0.0,
  total_cost REAL NOT NULL DEFAULT 0.0,
  total_revenue REAL NOT NULL DEFAULT 0.0,
  net_profit REAL NOT NULL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
