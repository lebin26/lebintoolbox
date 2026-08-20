-- Migration 0012: Add granular sub-app access control column to users table
ALTER TABLE users ADD COLUMN allowed_apps TEXT DEFAULT '["courtledger","advancemanager"]';

-- Super Admins and Managers receive all sub-apps access by default
UPDATE users SET allowed_apps = '["courtledger","advancemanager","admin"]' WHERE role = 'admin' OR role = 'manager';
