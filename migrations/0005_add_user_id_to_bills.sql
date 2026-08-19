-- Cloudflare D1 Migration: Add user_id column to bills table

ALTER TABLE bills ADD COLUMN user_id INTEGER;
