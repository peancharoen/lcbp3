-- File: specs/03-Data-and-Storage/deltas/2026-05-30-extend-ai-audit-logs.sql
-- เพิ่ม fields สำหรับ Typhoon OCR integration ใน ai_audit_logs
-- ตาม ADR-032: modelType, vramUsageMB, cacheHit
-- Change Log:
-- - 2026-05-30: Initial delta สำหรับ Typhoon OCR audit fields (T004)

-- เพิ่ม modelType: ระบุประเภทของ model ที่ใช้ (tesseract, typhoon-ocr-3b, typhoon2.1-gemma3-4b)
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS model_type VARCHAR(50) NULL COMMENT 'ประเภท OCR/LLM model ที่ใช้ เช่น tesseract, typhoon-ocr-3b' AFTER model_name;

-- เพิ่ม vramUsageMB: การใช้ VRAM จริง (MB) หลังประมวลผล
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS vram_usage_mb INT NULL COMMENT 'VRAM ที่ใช้จริง (MB) ณ เวลาประมวลผล' AFTER model_type;

-- เพิ่ม cacheHit: ระบุว่าผลลัพธ์นี้มาจาก Redis cache หรือ OCR จริง
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS cache_hit TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = ผลลัพธ์มาจาก Redis cache, 0 = OCR ใหม่' AFTER vram_usage_mb;

-- เพิ่ม index สำหรับ model_type เพื่อ analytics queries
ALTER TABLE ai_audit_logs
  ADD INDEX IF NOT EXISTS idx_ai_audit_model_type (model_type);
