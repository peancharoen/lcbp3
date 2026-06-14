-- File: specs/03-Data-and-Storage/deltas/2026-06-14-create-ai-execution-profiles.sql
-- Change Log:
-- - 2026-06-14: Created ai_execution_profiles and ai_sandbox_profiles tables (conforming to task T001)

CREATE TABLE IF NOT EXISTS ai_execution_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายใน',
  profile_name VARCHAR(50) NOT NULL COMMENT 'ชื่อ profile',
  canonical_model VARCHAR(20) NOT NULL DEFAULT 'np-dms-ai' COMMENT 'Model identity',
  temperature DECIMAL(4,3) NOT NULL COMMENT 'LLM temperature',
  top_p DECIMAL(4,3) NOT NULL COMMENT 'LLM top_p',
  max_tokens INT NULL COMMENT 'Maximum tokens',
  num_ctx INT NULL COMMENT 'Context window size',
  repeat_penalty DECIMAL(5,3) NOT NULL COMMENT 'Repeat penalty',
  keep_alive_seconds INT NOT NULL COMMENT 'Model keep_alive in seconds',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = active; 0 = disabled',
  updated_by INT NULL COMMENT 'user_id',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_profile_name (profile_name),
  INDEX idx_profile_active (profile_name, is_active),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'ตาราง execution profile parameters สำหรับ np-dms-ai';

CREATE TABLE IF NOT EXISTS ai_sandbox_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายใน',
  profile_name VARCHAR(50) NOT NULL COMMENT 'ชื่อ profile',
  canonical_model VARCHAR(20) NOT NULL DEFAULT 'np-dms-ai' COMMENT 'Model identity',
  temperature DECIMAL(4,3) NOT NULL COMMENT 'LLM temperature',
  top_p DECIMAL(4,3) NOT NULL COMMENT 'LLM top_p',
  max_tokens INT NULL COMMENT 'Maximum tokens',
  num_ctx INT NULL COMMENT 'Context window size',
  repeat_penalty DECIMAL(5,3) NOT NULL COMMENT 'Repeat penalty',
  keep_alive_seconds INT NOT NULL COMMENT 'Model keep_alive in seconds',
  updated_by INT NULL COMMENT 'user_id',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ai_sandbox_profile_name (profile_name),
  INDEX idx_ai_sandbox_profile_model (canonical_model),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'ตาราง sandbox profile parameters';
