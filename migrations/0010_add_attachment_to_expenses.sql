-- Migration 0010: Add Attachment and Receipt Support to am_expenses
ALTER TABLE am_expenses ADD COLUMN attachment_data TEXT;
