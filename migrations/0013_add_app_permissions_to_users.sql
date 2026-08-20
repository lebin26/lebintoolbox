-- Migration 0013: Add granular per-app action permissions to users table
ALTER TABLE users ADD COLUMN app_permissions TEXT DEFAULT '["courtledger:create_bill","courtledger:delete_bill","advancemanager:create_expense","advancemanager:delete_expense","advancemanager:settle","advancemanager:manage_people"]';

-- Admins and Managers receive all initial permissions
UPDATE users SET app_permissions = '["admin:create_user","admin:delete_user","admin:edit_user","admin:manage_venues","courtledger:create_bill","courtledger:delete_bill","advancemanager:create_expense","advancemanager:delete_expense","advancemanager:settle","advancemanager:manage_people"]' WHERE role = 'admin' OR role = 'manager';
