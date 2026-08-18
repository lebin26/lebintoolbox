-- Cloudflare D1 Migration: Create venues table and insert seed data

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  rate_morning REAL NOT NULL DEFAULT 0.0,
  rate_evening REAL NOT NULL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial venue data
INSERT OR IGNORE INTO venues (name, rate_morning, rate_evening) VALUES
('Lavana Sport Center Setapak', 14.84, 29.68),
('Setapak Badminton Center (SBC)', 14.00, 28.00);
