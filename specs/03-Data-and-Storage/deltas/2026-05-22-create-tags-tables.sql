-- File: specs/03-Data-and-Storage/deltas/2026-05-22-create-tags-tables.sql
-- Change Log:
-- - 2026-05-22: สร้างตาราง tags และ correspondence_tags ตาม ADR-028

-- Delta: สร้างตาราง tags และ correspondence_tags
-- Date: 2026-05-22
-- Related ADR: ADR-028, ADR-019
-- Applied in: v1.9.0 -> v1.9.5

-- ------------------------------------------------------------
-- การสร้างตาราง tags (Schema changes)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id          INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายในระบบ',
  public_id   CHAR(36) NOT NULL UNIQUE COMMENT 'UUIDv7 สำหรับการใช้งานภายนอก (ADR-019)',
  project_id  INT NULL COMMENT 'ID โครงการ (NULL = Global Tag)',
  tag_name    VARCHAR(100) NOT NULL COMMENT 'ชื่อแท็ก',
  color_code  VARCHAR(30) DEFAULT 'default' COMMENT 'รหัสสีสำหรับ UI',
  description TEXT COMMENT 'คำอธิบายเพิ่มเติม',
  created_by  INT COMMENT 'ผู้สร้างแท็ก',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at  TIMESTAMP NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY uq_tag_project (project_id, tag_name),
  INDEX idx_tags_deleted_at (deleted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลแท็กจัดหมวดหมู่เอกสาร';

-- ------------------------------------------------------------
-- การสร้างตาราง correspondence_tags (Schema changes)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS correspondence_tags (
  correspondence_id INT NOT NULL COMMENT 'ID ของเอกสาร',
  tag_id            INT NOT NULL COMMENT 'ID ของแท็ก',
  is_ai_suggested   BOOLEAN DEFAULT FALSE COMMENT 'แท็กนี้แนะนำโดย AI หรือไม่',
  confidence        DECIMAL(4,3) NULL COMMENT 'ค่าความมั่นใจของ AI (0.000–1.000)',
  created_by        INT COMMENT 'ผู้เชื่อมโยงแท็ก',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เชื่อมโยง',
  PRIMARY KEY (correspondence_id, tag_id),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_correspondence_tags_lookup (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมโยงความสัมพันธ์แบบ M:N ระหว่างเอกสารและแท็ก';
