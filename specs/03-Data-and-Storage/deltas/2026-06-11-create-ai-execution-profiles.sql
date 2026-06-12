-- Delta: สร้างตาราง ai_execution_profiles สำหรับ AI Runtime Policy Refactor
-- Date: 2026-06-11
-- Related ADR: ADR-029, Feature-235
-- Source of defaults: docs/ai-profiles.md
-- Applied in: v1.9.x (AI Runtime Policy Refactor cutover)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_execution_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายใน (ไม่ expose ใน API)',
  profile_name VARCHAR(50) NOT NULL COMMENT 'ชื่อ profile: interactive, standard, quality, deep-analysis',
  temperature DECIMAL(4,3) NOT NULL COMMENT 'LLM temperature parameter',
  top_p DECIMAL(4,3) NOT NULL COMMENT 'LLM top_p parameter',
  max_tokens INT NOT NULL COMMENT 'Maximum tokens to generate',
  num_ctx INT NOT NULL COMMENT 'Context window size (tokens)',
  repeat_penalty DECIMAL(5,3) NOT NULL COMMENT 'Repeat penalty parameter',
  keep_alive_seconds INT NOT NULL COMMENT 'Model keep_alive in seconds (0 = unload immediately)',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = profile นี้ใช้งานได้; 0 = disabled',
  updated_by INT NULL COMMENT 'user_id ที่แก้ไขล่าสุด (NULL = seed default)',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_profile_name (profile_name),
  INDEX idx_profile_active (profile_name, is_active),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'ตาราง execution profile parameters สำหรับ np-dms-ai (ADR-029, Feature-235); ค่า default จาก docs/ai-profiles.md';

-- ------------------------------------------------------------
-- Seed: default profiles จาก docs/ai-profiles.md
-- ------------------------------------------------------------
INSERT INTO ai_execution_profiles (
  profile_name, temperature, top_p, max_tokens, num_ctx, repeat_penalty, keep_alive_seconds
) VALUES
  ('interactive',   0.700, 0.900, 2048,  4096,  1.150, 300),   -- keep_alive: "5m"
  ('standard',      0.500, 0.800, 4096,  8192,  1.150, 600),   -- keep_alive: "10m"
  ('quality',       0.100, 0.950, 8192,  8192,  1.150, 600),   -- keep_alive: "10m"
  ('deep-analysis', 0.300, 0.850, 8192, 32768,  1.150, 0)      -- keep_alive: "0" (admin sandbox only)
ON DUPLICATE KEY UPDATE
  profile_name = profile_name; -- no-op: ไม่ overwrite ค่าที่ admin calibrate ไว้แล้ว
