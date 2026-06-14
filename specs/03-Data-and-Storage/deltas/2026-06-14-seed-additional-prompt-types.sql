-- File: specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql
-- Change Log:
-- - 2026-06-14: Seed additional prompt types for RAG Query, RAG Prep, and Classification (conforming to task T003)

INSERT INTO ai_prompts (
    public_id,
    prompt_type,
    version_number,
    template,
    field_schema,
    context_config,
    is_active,
    manual_note,
    activated_at,
    created_by
) VALUES
  (
    UUID(),
    'rag_query_prompt',
    1,
    'You are a professional assistant analyzing project documents. Based on the provided context, answer the user query.\n\nContext:\n{{context}}\n\nUser Query:\n{{ocr_text}}\n\nAnswer:',
    NULL,
    NULL,
    1,
    'Initial seed for RAG query prompt',
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
  ),
  (
    UUID(),
    'rag_prep_prompt',
    1,
    'Analyze the following OCR text and prepare chunks for retrieval database.\n\nOCR TEXT:\n{{ocr_text}}\n\nChunks:',
    NULL,
    NULL,
    1,
    'Initial seed for RAG prep prompt',
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
  ),
  (
    UUID(),
    'classification_prompt',
    1,
    'Classify the following document based on its OCR text.\n\nOCR TEXT:\n{{ocr_text}}\n\nClassification (Correspondence, Transmittal, Circulation, RFA, Shop Drawing, Contract Drawing):',
    NULL,
    NULL,
    1,
    'Initial seed for Classification prompt',
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
  )
ON DUPLICATE KEY UPDATE
  prompt_type = prompt_type;
