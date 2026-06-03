-- Delta: Update ai_available_models for Thai-Optimized Model Stack (ADR-034)
-- Date: 2026-06-03
-- Author: AI Assistant
-- Related: ADR-034 — Thai-Optimized AI Model Stack, supersedes ADR-023A Section 2.1
-- Rollback: 2026-06-03-update-ai-available-models-typhoon.rollback.sql

-- 1. Insert new main model (typhoon2.5-np-dms) as default, demote old defaults
INSERT INTO ai_available_models (model_name, model_version, description, vram_gb, is_active, is_default)
VALUES (
    'typhoon2.5-np-dms:latest',
    'latest',
    'Thai-optimized main AI model based on typhoon2.5-qwen3-4b (~2.5GB VRAM, standby mode) — ADR-034',
    2.50,
    TRUE,
    TRUE
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    vram_gb     = VALUES(vram_gb),
    is_active   = TRUE,
    is_default  = TRUE,
    updated_at  = NOW();

-- Demote old gemma4 models from default status
UPDATE ai_available_models
SET is_default = FALSE, updated_at = NOW()
WHERE model_name IN ('gemma4:e2b', 'gemma4:e4b', 'typhoon2.1-gemma3-4b');

-- 2. Insert OCR model (typhoon-np-dms-ocr) — not default, keep_alive=0 (unload after each job)
INSERT INTO ai_available_models (model_name, model_version, description, vram_gb, is_active, is_default)
VALUES (
    'typhoon-np-dms-ocr:latest',
    'latest',
    'Thai OCR model based on typhoon-ocr1.5-3b (~3.2GB VRAM, unloads after each job) — ADR-034',
    3.20,
    TRUE,
    FALSE
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    vram_gb     = VALUES(vram_gb),
    is_active   = TRUE,
    updated_at  = NOW();

-- 3. Update active model in system_settings to typhoon2.5-np-dms:latest
UPDATE system_settings
SET setting_value = 'typhoon2.5-np-dms:latest',
    updated_at    = NOW()
WHERE setting_key = 'AI_ACTIVE_MODEL';
