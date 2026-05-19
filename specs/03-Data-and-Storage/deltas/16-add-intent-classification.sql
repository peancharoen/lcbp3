-- Delta 16: Add Intent Classification Tables (ADR-024)
-- Feature: 224-intent-classification
-- Created: 2026-05-19
-- เพิ่มตาราง ai_intent_definitions และ ai_intent_patterns สำหรับ Hybrid Intent Classifier

-- Intent Definitions Table
CREATE TABLE IF NOT EXISTS ai_intent_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT UUID(),
  intent_code VARCHAR(50) NOT NULL,
  description_th VARCHAR(255) NOT NULL,
  description_en VARCHAR(255) NOT NULL,
  category ENUM('read', 'suggest', 'utility') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_intent_public_id (public_id),
  UNIQUE KEY uk_intent_code (intent_code),
  INDEX idx_intent_active (is_active, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intent Patterns Table
CREATE TABLE IF NOT EXISTS ai_intent_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT UUID(),
  intent_code VARCHAR(50) NOT NULL,
  language ENUM('th', 'en', 'any') NOT NULL DEFAULT 'any',
  pattern_type ENUM('keyword', 'regex') NOT NULL DEFAULT 'keyword',
  pattern_value VARCHAR(255) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_pattern_public_id (public_id),
  INDEX idx_pattern_intent_code (intent_code),
  INDEX idx_pattern_active_priority (is_active, priority ASC),
  CONSTRAINT fk_intent_pattern_definition
    FOREIGN KEY (intent_code) REFERENCES ai_intent_definitions(intent_code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Intent Definitions (v1) — 12 รายการตาม ADR-024
INSERT IGNORE INTO ai_intent_definitions (intent_code, description_th, description_en, category) VALUES
-- Read Intents
('RAG_QUERY',         'ถามคำถามธรรมชาติ ตอบจาก vector + doc context',    'Natural language query from vector DB + document context', 'read'),
('GET_RFA',           'ดึง RFA ตาม filter',                               'Get RFA by filters',                                      'read'),
('GET_DRAWING',       'ดึง Drawing revision',                              'Get Drawing revision',                                    'read'),
('GET_TRANSMITTAL',   'ดึง Transmittal',                                   'Get Transmittal',                                         'read'),
('GET_CORRESPONDENCE','ดึง Correspondence ทั่วไป',                         'Get Correspondence',                                      'read'),
('GET_CIRCULATION',   'ดึง Circulation',                                   'Get Circulation',                                         'read'),
('GET_RFA_DRAWINGS',  'ดึง Drawings ที่ผูกกับ RFA',                        'Get Drawings linked to RFA',                              'read'),
('SUMMARIZE_DOCUMENT','สรุปเอกสารที่เปิดอยู่',                             'Summarize current document',                              'read'),
('LIST_OVERDUE',      'รายการ cross-entity ที่เกินกำหนด',                  'List overdue items across entities',                      'read'),
-- Suggest Intents
('SUGGEST_METADATA',  'แนะนำ metadata สำหรับเอกสารที่อัปโหลด',            'Suggest metadata for uploaded document',                   'suggest'),
('SUGGEST_ACTION',    'แจ้งเตือนว่าควรทำอะไรต่อ',                         'Suggest next actions',                                    'suggest'),
-- Utility Intents
('FALLBACK',          'ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ',           'No matching intent / unrelated to system',                'utility');
