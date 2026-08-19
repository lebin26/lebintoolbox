-- Cloudflare D1 Migration: Create users table and seed initial admin & user accounts

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'deleted'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Admin User (admin@hostcalculator.com / AdminPassword123!)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status)
VALUES (1, 'admin@hostcalculator.com', '32aea8496a0fbe63126d6dd96d71ce34643a2760063fbc229c848d672b39e1bb', 'Admin Lebin', 'admin', 'active');

-- Seed Initial Standard Test User (user@hostcalculator.com / UserPassword123!)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status)
VALUES (2, 'user@hostcalculator.com', '01c40cfc13b8c88fe006329b762024fe720f8c9f5a383d1b0cd09ac49c085bac', 'Standard User', 'user', 'active');
