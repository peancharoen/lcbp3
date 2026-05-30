-- Delta: Seed Typhoon model option into ai_available_models
-- Date: 2026-05-30
-- Related: ADR-027, ADR-032, specs/200-fullstacks/232-typhoon-ocr-integration

INSERT INTO ai_available_models (
    model_name,
    model_version,
    description,
    vram_gb,
    is_active,
    is_default
)
SELECT
    'typhoon2.1-gemma3-4b',
    '4b',
    'Typhoon 2.1 Gemma3 4B - Thai-focused local LLM option for AI Admin Console',
    4.50,
    TRUE,
    FALSE
WHERE NOT EXISTS (
    SELECT 1
    FROM ai_available_models
    WHERE model_name = 'typhoon2.1-gemma3-4b'
);
