-- Migration 0005: Create user lebin2626@gmail.com as Admin and assign existing financial data & bills

-- 1. Insert or ignore Admin User lebin2626@gmail.com
INSERT INTO users (username, password_hash, salt, role, status, nickname, allowed_apps, app_permissions)
VALUES (
  'lebin2626@gmail.com',
  'fb77f52ecf9086d2d6f169426193b3854722de7defa68524771010ac36f33d2f',
  'a8f3b29c104e76d5e21908472910cbae',
  'admin',
  'active',
  'Lebin',
  '["courtledger","financial"]',
  '["courtledger:create_bill","courtledger:delete_bill","financial:manage","admin:manage"]'
)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  salt = excluded.salt,
  role = 'admin',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

-- 2. Assign all existing unassigned financial platforms, products, periods & bills
UPDATE financial_platforms SET user_id = (SELECT id FROM users WHERE username = 'lebin2626@gmail.com') WHERE user_id IS NULL;
UPDATE financial_products SET user_id = (SELECT id FROM users WHERE username = 'lebin2626@gmail.com') WHERE user_id IS NULL;
UPDATE financial_periods SET user_id = (SELECT id FROM users WHERE username = 'lebin2626@gmail.com') WHERE user_id IS NULL;
UPDATE bills SET user_id = (SELECT id FROM users WHERE username = 'lebin2626@gmail.com') WHERE user_id IS NULL;
