-- Migration 0011: Add is_temporary and is_favourite to am_persons
ALTER TABLE am_persons ADD COLUMN is_temporary INTEGER DEFAULT 0;
ALTER TABLE am_persons ADD COLUMN is_favourite INTEGER DEFAULT 0;
