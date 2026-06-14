-- File: specs/03-Data-and-Storage/deltas/2026-06-14-seed-execution-profiles.sql
-- Change Log:
-- - 2026-06-14: Seed default profiles for execution profiles (conforming to task T002)

INSERT INTO ai_execution_profiles (
  profile_name, canonical_model, temperature, top_p, max_tokens, num_ctx, repeat_penalty, keep_alive_seconds, is_active
) VALUES
  ('interactive',   'np-dms-ai',  0.700, 0.900, 2048,  4096,  1.150, 300, 1),
  ('standard',      'np-dms-ai',  0.500, 0.800, 4096,  8192,  1.150, 600, 1),
  ('quality',       'np-dms-ai',  0.100, 0.950, 8192,  8192,  1.150, 600, 1),
  ('deep-analysis', 'np-dms-ai',  0.300, 0.850, 8192, 32768,  1.150, 0,   1),
  ('ocr-extract',   'np-dms-ocr', 0.100, 0.100, NULL,  NULL,  1.100, 0,   1)
ON DUPLICATE KEY UPDATE
  canonical_model = VALUES(canonical_model),
  temperature = VALUES(temperature),
  top_p = VALUES(top_p),
  max_tokens = VALUES(max_tokens),
  num_ctx = VALUES(num_ctx),
  repeat_penalty = VALUES(repeat_penalty),
  keep_alive_seconds = VALUES(keep_alive_seconds),
  is_active = VALUES(is_active);
