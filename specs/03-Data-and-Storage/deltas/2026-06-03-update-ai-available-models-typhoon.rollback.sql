-- Rollback: Revert ai_available_models to gemma4 stack (undo ADR-034 delta)
-- Date: 2026-06-03
-- Pair: 2026-06-03-update-ai-available-models-typhoon.sql

-- 1. Remove Typhoon models
DELETE FROM ai_available_models
WHERE model_name IN ('typhoon2.5-np-dms:latest', 'typhoon-np-dms-ocr:latest');

-- 2. Restore gemma4:e2b as default
UPDATE ai_available_models
SET is_default = TRUE, updated_at = NOW()
WHERE model_name = 'gemma4:e2b';

-- 3. Revert system_settings active model
UPDATE system_settings
SET setting_value = 'gemma4:e2b',
    updated_at    = NOW()
WHERE setting_key = 'AI_ACTIVE_MODEL';
