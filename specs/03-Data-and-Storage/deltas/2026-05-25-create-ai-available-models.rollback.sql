-- Rollback: Drop ai_available_models table
-- Date: 2026-05-25

-- Remove system setting first
DELETE FROM system_settings WHERE setting_key = 'AI_ACTIVE_MODEL';

-- Drop table
DROP TABLE IF EXISTS ai_available_models;
