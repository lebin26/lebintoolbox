-- Cloudflare D1 Migration: Add plain_password column to users table
-- Allows administrator to view user plaintext passwords for account recovery and customer support

ALTER TABLE users ADD COLUMN plain_password TEXT;

-- Update existing test users with their initial plain passwords
UPDATE users SET plain_password = 'AdminPassword123!' WHERE email = 'admin@hostcalculator.com';
UPDATE users SET plain_password = 'UserPassword123!' WHERE email = 'user@hostcalculator.com';
