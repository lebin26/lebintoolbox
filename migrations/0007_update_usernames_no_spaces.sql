-- Cloudflare D1 Migration: Update user names to remove spaces and conform to username specifications
-- Changes 'Admin Lebin' to 'admin_lebin' and 'Standard User' to 'test_user'

UPDATE users 
SET name = 'admin_lebin' 
WHERE email = 'admin@hostcalculator.com' OR name = 'Admin Lebin';

UPDATE users 
SET name = 'test_user' 
WHERE email = 'user@hostcalculator.com' OR name = 'Standard User';
