-- Delta: สร้างตาราง system_settings และ Seed ข้อมูล AI_FEATURES_ENABLED
-- Date: 2026-05-22
-- Related ADR: ADR-027
-- Applied in: v1.9.0 -> v1.9.5

-- ------------------------------------------------------------
-- การเปลี่ยนแปลงโครงสร้างฐานข้อมูล (Schema changes)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'คีย์การตั้งค่าระบบ',
  setting_value TEXT NOT NULL COMMENT 'ค่าที่บันทึก (stringified)',
  data_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT 'ประเภทข้อมูลสำหรับ validation',
  category VARCHAR(50) COMMENT 'หมวดหมู่',
  is_encrypted TINYINT(1) DEFAULT 0 COMMENT 'เข้ารหัสค่า sensitive',
  validation_rules JSON COMMENT 'กฎ validation',
  description TEXT COMMENT 'คำอธิบายข้อมูลการตั้งค่า',
  is_public TINYINT(1) DEFAULT 0 COMMENT 'เผยแพร่ให้ frontend อ่านได้หรือ admin only',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_system_settings_category (category),
  INDEX idx_system_settings_is_public (is_public)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลการตั้งค่าระบบไดนามิก';

-- ------------------------------------------------------------
-- การเพิ่มข้อมูลพื้นฐาน (Seed Data)
-- ------------------------------------------------------------

INSERT INTO system_settings (
  setting_key,
  setting_value,
  data_type,
  category,
  description,
  is_public
)
VALUES (
  'AI_FEATURES_ENABLED',
  'true',
  'boolean',
  'ai',
  'สถานะเปิด/ปิดการใช้งานฟีเจอร์ AI ทั้งระบบ สำหรับผู้ใช้ทั่วไป',
  1
)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
