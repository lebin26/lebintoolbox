-- Cloudflare D1 Migration: Assign legacy unassigned bills to primary Admin (User ID 1)

UPDATE bills
SET user_id = 1
WHERE user_id IS NULL;
