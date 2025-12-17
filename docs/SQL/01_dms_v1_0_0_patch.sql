-- ==========================================================
-- DMS v1.0.1 Patch
-- Reason: Add missing relationship for Req 2.5.3
-- Update: Changed link to revision-level instead of master-level based on clarification.
-- ==========================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS=1;

-- สร้างตารางเชื่อมระหว่าง shop_drawing_revisions (ตารางลูก) กับ contract_drawings (Master)
-- เพื่อรองรับ Requirement 2.5.3 ที่ระบุว่า Shop Drawing "แต่ละ revision" สามารถอ้างอิง Contract Drawing ที่แตกต่างกันได้
CREATE TABLE shop_drawing_revision_contract_refs (
  shop_drawing_revision_id INT NOT NULL COMMENT 'ID ของ Shop Drawing Revision (FK -> shop_drawing_revisions.id)',
  contract_drawing_id      INT NOT NULL COMMENT 'ID ของ Contract Drawing ที่อ้างอิง (FK -> contract_drawings.condwg_id)',
  
  -- PRIMARY KEY (shop_drawing_revision_id, contract_drawing_id),
  
  -- เพิ่ม KEY เพื่อประสิทธิภาพในการค้นหา
  KEY idx_sdrcr_rev (shop_drawing_revision_id),
  KEY idx_sdrcr_cd (contract_drawing_id),

  -- Foreign Keys
  CONSTRAINT fk_sdrcr_revision 
    FOREIGN KEY (shop_drawing_revision_id) 
    REFERENCES shop_drawing_revisions(id) -- เชื่อมโยงกับตาราง Revision
    ON DELETE CASCADE
    ON UPDATE CASCADE,
    
  CONSTRAINT fk_sdrcr_contract_drawing
    FOREIGN KEY (contract_drawing_id) 
    REFERENCES contract_drawings(condwg_id) 
    ON DELETE CASCADE
    ON UPDATE CASCADE
) 
ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_general_ci 
COMMENT='ตารางเชื่อมโยง Shop Drawing Revisions กับ Contract Drawings (Req 2.5.3)';

