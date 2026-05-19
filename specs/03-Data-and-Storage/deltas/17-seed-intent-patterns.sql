-- Delta 17: Seed Intent Patterns (v1) for ADR-024 Intent Classification
-- Feature: 224-intent-classification
-- Created: 2026-05-19
-- เพิ่ม patterns เริ่มต้นสำหรับ 12 Intent Definitions (keyword + regex)

-- RAG_QUERY patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('RAG_QUERY', 'th', 'keyword', 'ค้นหา', 10),
('RAG_QUERY', 'th', 'keyword', 'หาข้อมูล', 10),
('RAG_QUERY', 'en', 'keyword', 'search', 10),
('RAG_QUERY', 'en', 'keyword', 'find', 10),
('RAG_QUERY', 'any', 'regex', '(?i)(what|where|who|when|how|why).*\\?', 50);

-- GET_RFA patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_RFA', 'th', 'keyword', 'rfa', 10),
('GET_RFA', 'th', 'keyword', 'อาร์เอฟเอ', 10),
('GET_RFA', 'en', 'keyword', 'request for approval', 15),
('GET_RFA', 'any', 'regex', '(?i)rfa[- ]?\\d+', 5);

-- GET_DRAWING patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_DRAWING', 'th', 'keyword', 'แบบ', 20),
('GET_DRAWING', 'th', 'keyword', 'drawing', 10),
('GET_DRAWING', 'en', 'keyword', 'drawing', 10),
('GET_DRAWING', 'en', 'keyword', 'revision', 20),
('GET_DRAWING', 'any', 'regex', '(?i)(shop.?draw|dwg|rev\\.?\\s*\\d)', 5);

-- GET_TRANSMITTAL patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_TRANSMITTAL', 'th', 'keyword', 'transmittal', 10),
('GET_TRANSMITTAL', 'th', 'keyword', 'ทรานส์มิตทอล', 10),
('GET_TRANSMITTAL', 'en', 'keyword', 'transmittal', 10),
('GET_TRANSMITTAL', 'any', 'regex', '(?i)tr[- ]?\\d+', 5);

-- GET_CORRESPONDENCE patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_CORRESPONDENCE', 'th', 'keyword', 'จดหมาย', 10),
('GET_CORRESPONDENCE', 'th', 'keyword', 'หนังสือ', 15),
('GET_CORRESPONDENCE', 'en', 'keyword', 'correspondence', 10),
('GET_CORRESPONDENCE', 'en', 'keyword', 'letter', 15);

-- GET_CIRCULATION patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_CIRCULATION', 'th', 'keyword', 'เวียน', 10),
('GET_CIRCULATION', 'th', 'keyword', 'circulation', 10),
('GET_CIRCULATION', 'en', 'keyword', 'circulation', 10),
('GET_CIRCULATION', 'en', 'keyword', 'distribute', 15);

-- GET_RFA_DRAWINGS patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('GET_RFA_DRAWINGS', 'th', 'keyword', 'แบบใน rfa', 5),
('GET_RFA_DRAWINGS', 'en', 'keyword', 'drawings in rfa', 5),
('GET_RFA_DRAWINGS', 'any', 'regex', '(?i)(draw|แบบ).*(rfa|อาร์เอฟเอ)', 5);

-- SUMMARIZE_DOCUMENT patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('SUMMARIZE_DOCUMENT', 'th', 'keyword', 'สรุป', 10),
('SUMMARIZE_DOCUMENT', 'th', 'keyword', 'สรุปเอกสาร', 5),
('SUMMARIZE_DOCUMENT', 'en', 'keyword', 'summarize', 10),
('SUMMARIZE_DOCUMENT', 'en', 'keyword', 'summary', 10),
('SUMMARIZE_DOCUMENT', 'any', 'regex', '(?i)(สรุป|summar|tldr|tl;dr)', 5);

-- LIST_OVERDUE patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('LIST_OVERDUE', 'th', 'keyword', 'เกินกำหนด', 10),
('LIST_OVERDUE', 'th', 'keyword', 'ค้าง', 15),
('LIST_OVERDUE', 'th', 'keyword', 'overdue', 10),
('LIST_OVERDUE', 'en', 'keyword', 'overdue', 10),
('LIST_OVERDUE', 'en', 'keyword', 'late', 20),
('LIST_OVERDUE', 'any', 'regex', '(?i)(overdue|เกินกำหนด|ล่าช้า)', 5);

-- SUGGEST_METADATA patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('SUGGEST_METADATA', 'th', 'keyword', 'แนะนำ metadata', 5),
('SUGGEST_METADATA', 'th', 'keyword', 'แท็ก', 15),
('SUGGEST_METADATA', 'en', 'keyword', 'suggest metadata', 5),
('SUGGEST_METADATA', 'en', 'keyword', 'tag', 15),
('SUGGEST_METADATA', 'any', 'regex', '(?i)(suggest|แนะนำ).*(tag|meta|ประเภท)', 5);

-- SUGGEST_ACTION patterns
INSERT IGNORE INTO ai_intent_patterns (intent_code, language, pattern_type, pattern_value, priority) VALUES
('SUGGEST_ACTION', 'th', 'keyword', 'ทำอะไรต่อ', 10),
('SUGGEST_ACTION', 'th', 'keyword', 'แนะนำ', 20),
('SUGGEST_ACTION', 'en', 'keyword', 'what should i do', 10),
('SUGGEST_ACTION', 'en', 'keyword', 'next step', 10),
('SUGGEST_ACTION', 'any', 'regex', '(?i)(next.?step|ทำอะไร|ควรทำ|what.*do)', 10);

-- FALLBACK: ไม่ต้อง seed pattern — ใช้เป็น default เมื่อไม่ match อะไรเลย
