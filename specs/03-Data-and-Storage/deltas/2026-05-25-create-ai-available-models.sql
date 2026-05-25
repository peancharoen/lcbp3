-- Delta: Create ai_available_models table for dynamic AI model selection
-- Date: 2026-05-25
-- Author: AI Assistant
-- Related: ADR-027 AI Admin Console - Dynamic model control

-- Create table for available AI models
CREATE TABLE IF NOT EXISTS ai_available_models (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL COMMENT 'ชื่อโมเดล เช่น gemma4:e2b, gemma4:e4b',
    model_version VARCHAR(50) NOT NULL COMMENT 'เวอร์ชั่นของโมเดล',
    description VARCHAR(500) NULL COMMENT 'รายละเอียดโมเดล',
    vram_gb DECIMAL(4,2) NULL COMMENT 'VRAM ที่ใช้โดยประมาณ (GB)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะใช้งาน',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'โมเดลเริ่มต้น',
    created_by INT NULL,
    updated_by INT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    
    UNIQUE KEY uk_model_name (model_name),
    INDEX idx_is_active (is_active),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ตารางเก็บรายการโมเดล AI ที่ให้เลือกใช้งานในระบบ (ADR-027)';

-- Insert default models per ADR-023A
INSERT INTO ai_available_models (model_name, model_version, description, vram_gb, is_active, is_default) VALUES
('gemma4:e2b', 'e2b', 'Gemma 4 E2B - 2-bit quantized, ~2GB VRAM, recommended per ADR-023A', 2.00, TRUE, TRUE),
('gemma4:e4b', 'e4b', 'Gemma 4 E4B - 4-bit quantized, ~4GB VRAM', 4.00, TRUE, FALSE);

-- Add system setting for active model (reference to ai_available_models)
INSERT INTO system_settings (setting_key, setting_value, data_type, category, description, is_public, created_at, updated_at)
SELECT 
    'AI_ACTIVE_MODEL',
    (SELECT model_name FROM ai_available_models WHERE is_default = TRUE LIMIT 1),
    'string',
    'ai',
    'โมเดล AI ที่ใช้งานอยู่ในระบบ (global)',
    TRUE,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'AI_ACTIVE_MODEL');
