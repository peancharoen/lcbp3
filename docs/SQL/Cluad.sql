-- ปรับปรุงโครงสร้าง Correspondence เพื่อจัดการ Revisions ได้ดีขึ้น

-- 1. แยก Master และ Revision ชัดเจน
CREATE TABLE correspondence_master (
  master_id             INT AUTO_INCREMENT PRIMARY KEY,
  correspondence_number VARCHAR(100) NOT NULL,
  project_id            INT NOT NULL,
  correspondence_type_id INT NOT NULL,
  
  -- Metadata ที่ไม่เปลี่ยนแปลงตาม Revision
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            INT NULL,
  deleted_at            DATETIME NULL,
  
  -- Track current/latest revision
  current_revision_id   INT NULL,
  latest_revision_number INT NOT NULL DEFAULT 0,
  
  CONSTRAINT uq_corr_no_per_project UNIQUE (project_id, correspondence_number),
  
  CONSTRAINT fk_cm_project FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cm_type FOREIGN KEY (correspondence_type_id) 
    REFERENCES correspondence_types(type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cm_created_by FOREIGN KEY (created_by) 
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Revision ที่เก็บข้อมูลที่เปลี่ยนแปลงได้
CREATE TABLE correspondence_revisions_new (
  revision_id           INT AUTO_INCREMENT PRIMARY KEY,
  master_id             INT NOT NULL,
  revision_number       INT NOT NULL, -- เปลี่ยนเป็น INT เพื่อง่ายต่อการเรียงลำดับ
  revision_label        VARCHAR(10) NULL, -- A, B, C สำหรับแสดงผล
  
  -- สถานะเฉพาะของ Revision นี้
  correspondence_status_id INT NOT NULL,
  is_current            BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- ข้อมูลที่เปลี่ยนแปลงตาม Revision
  originator_id         INT NULL,
  recipient_id          INT NULL,
  title                 VARCHAR(255) NOT NULL,
  keywords              VARCHAR(255) NULL,
  issued_date           DATETIME NULL,
  pdf_path              VARCHAR(500) NULL,
  details               JSON NULL,
  
  -- Audit
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            INT NULL,
  change_reason         TEXT NULL,
  
  CONSTRAINT uq_master_revision_number UNIQUE (master_id, revision_number),
  CONSTRAINT uq_master_current UNIQUE (master_id, is_current), -- ใช้ partial unique index ได้ดีกว่า
  
  CONSTRAINT fk_cr_master FOREIGN KEY (master_id) 
    REFERENCES correspondence_master(master_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cr_status FOREIGN KEY (correspondence_status_id) 
    REFERENCES correspondence_status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cr_originator FOREIGN KEY (originator_id) 
    REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cr_recipient FOREIGN KEY (recipient_id) 
    REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cr_created_by FOREIGN KEY (created_by) 
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Update current_revision_id FK
ALTER TABLE correspondence_master
  ADD CONSTRAINT fk_cm_current_revision 
  FOREIGN KEY (current_revision_id) 
  REFERENCES correspondence_revisions_new(revision_id) 
  ON UPDATE CASCADE ON DELETE SET NULL;

-- 4. View สำหรับ Query ง่าย (รวม Master + Current Revision)
CREATE OR REPLACE VIEW v_current_correspondences AS
SELECT 
  cm.master_id,
  cm.correspondence_number,
  cm.project_id,
  cm.correspondence_type_id,
  cr.revision_id,
  cr.revision_number,
  cr.revision_label,
  cr.correspondence_status_id,
  cr.title,
  cr.keywords,
  cr.originator_id,
  cr.recipient_id,
  cr.issued_date,
  cr.pdf_path,
  cr.details,
  cm.created_at AS master_created_at,
  cr.created_at AS revision_created_at,
  cm.latest_revision_number
FROM correspondence_master cm
INNER JOIN correspondence_revisions_new cr 
  ON cm.current_revision_id = cr.revision_id
WHERE cm.deleted_at IS NULL;

-- 5. Stored Procedure สำหรับสร้าง Revision ใหม่
DELIMITER $$

CREATE PROCEDURE sp_create_correspondence_revision(
  IN p_master_id INT,
  IN p_title VARCHAR(255),
  IN p_originator_id INT,
  IN p_recipient_id INT,
  IN p_status_id INT,
  IN p_created_by INT,
  IN p_change_reason TEXT,
  OUT p_revision_id INT
)
BEGIN
  DECLARE v_next_revision_number INT;
  DECLARE v_revision_label VARCHAR(10);
  
  -- Get next revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1 
  INTO v_next_revision_number
  FROM correspondence_revisions_new
  WHERE master_id = p_master_id;
  
  -- Generate label (0->Original, 1->A, 2->B, etc.)
  IF v_next_revision_number = 0 THEN
    SET v_revision_label = 'Original';
  ELSE
    SET v_revision_label = CHAR(64 + v_next_revision_number); -- A, B, C...
  END IF;
  
  -- Mark all previous revisions as not current
  UPDATE correspondence_revisions_new 
  SET is_current = FALSE 
  WHERE master_id = p_master_id;
  
  -- Insert new revision
  INSERT INTO correspondence_revisions_new (
    master_id, revision_number, revision_label,
    correspondence_status_id, is_current,
    title, originator_id, recipient_id,
    created_by, change_reason
  ) VALUES (
    p_master_id, v_next_revision_number, v_revision_label,
    p_status_id, TRUE,
    p_title, p_originator_id, p_recipient_id,
    p_created_by, p_change_reason
  );
  
  SET p_revision_id = LAST_INSERT_ID();
  
  -- Update master
  UPDATE correspondence_master
  SET 
    current_revision_id = p_revision_id,
    latest_revision_number = v_next_revision_number
  WHERE master_id = p_master_id;
END$$

DELIMITER ;



-- *****************************************************
-- *****************************************************
-- *****************************************************
-- *****************************************************
-- *****************************************************
-- *****************************************************

-- ปรับปรุง Technical Documents เพื่อความชัดเจนและเชื่อมโยงกับ Correspondence

-- 1. Technical Document Master
CREATE TABLE technical_document_master (
  master_id         INT AUTO_INCREMENT PRIMARY KEY,
  document_number   VARCHAR(100) NOT NULL,
  document_type_id  INT NOT NULL,
  project_id        INT NOT NULL,
  title             VARCHAR(255) NOT NULL,
  
  -- Link to RFA Correspondence (optional - เพราะอาจยังไม่ได้ส่ง RFA)
  rfa_correspondence_id INT NULL,
  
  -- Tracking
  current_revision_id INT NULL,
  latest_revision_number INT NOT NULL DEFAULT 0,
  
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by        INT NULL,
  deleted_at        DATETIME NULL,
  
  CONSTRAINT uq_techdoc_no_project UNIQUE (project_id, document_number),
  
  CONSTRAINT fk_tdm_type FOREIGN KEY (document_type_id) 
    REFERENCES technicaldoc_types(document_types_id),
  CONSTRAINT fk_tdm_project FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_tdm_rfa_corr FOREIGN KEY (rfa_correspondence_id) 
    REFERENCES correspondences(corr_id) ON DELETE SET NULL,
  CONSTRAINT fk_tdm_created_by FOREIGN KEY (created_by) 
    REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Technical Document Revisions
CREATE TABLE technical_document_revisions (
  revision_id       INT AUTO_INCREMENT PRIMARY KEY,
  master_id         INT NOT NULL,
  revision_number   INT NOT NULL,
  revision_label    VARCHAR(10) NULL, -- A, B, C
  
  status_code_id    INT NOT NULL,
  approve_code_id   INT NULL,
  is_current        BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- File references
  pdf_path          VARCHAR(500) NULL,
  dwg_path          VARCHAR(500) NULL, -- สำหรับ DWG type
  
  -- Metadata
  revision_description TEXT NULL,
  submitted_date    DATE NULL,
  approved_date     DATE NULL,
  
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by        INT NULL,
  updated_by        INT NULL,
  
  CONSTRAINT uq_master_rev_number UNIQUE (master_id, revision_number),
  
  CONSTRAINT fk_tdr_master FOREIGN KEY (master_id) 
    REFERENCES technical_document_master(master_id) ON DELETE CASCADE,
  CONSTRAINT fk_tdr_status FOREIGN KEY (status_code_id) 
    REFERENCES technicaldoc_status_codes(status_code_id),
  CONSTRAINT fk_tdr_approve FOREIGN KEY (approve_code_id) 
    REFERENCES technicaldoc_approve_codes(approve_code_id) ON DELETE SET NULL,
  CONSTRAINT fk_tdr_created_by FOREIGN KEY (created_by) 
    REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_tdr_updated_by FOREIGN KEY (updated_by) 
    REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Shop Drawing References (Many-to-Many with Revisions)
CREATE TABLE technical_document_shop_drawing_refs (
  tech_doc_revision_id INT NOT NULL,
  shop_drawing_rev_id INT NOT NULL,
  reference_type ENUM('SUPERSEDES', 'RELATED', 'AS_PER') DEFAULT 'RELATED',
  
  PRIMARY KEY (tech_doc_revision_id, shop_drawing_rev_id),
  
  CONSTRAINT fk_tdsdr_tech_doc FOREIGN KEY (tech_doc_revision_id) 
    REFERENCES technical_document_revisions(revision_id) ON DELETE CASCADE,
  CONSTRAINT fk_tdsdr_shop_dwg FOREIGN KEY (shop_drawing_rev_id) 
    REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Contract Drawing References (Many-to-Many)
CREATE TABLE technical_document_contract_drawing_refs (
  tech_doc_revision_id INT NOT NULL,
  contract_drawing_id INT NOT NULL,
  reference_type ENUM('AS_PER', 'RELATED') DEFAULT 'AS_PER',
  sheet_numbers VARCHAR(255) NULL, -- "Sheet 1-5, 10" เก็บเป็น text
  
  PRIMARY KEY (tech_doc_revision_id, contract_drawing_id),
  
  CONSTRAINT fk_tdcdr_tech_doc FOREIGN KEY (tech_doc_revision_id) 
    REFERENCES technical_document_revisions(revision_id) ON DELETE CASCADE,
  CONSTRAINT fk_tdcdr_contract_dwg FOREIGN KEY (contract_drawing_id) 
    REFERENCES contract_drawings(condwg_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. ปรับปรุง RFA Workflow ให้ชัดเจนขึ้น
CREATE TABLE rfa_workflow_instances (
  workflow_id       INT AUTO_INCREMENT PRIMARY KEY,
  rfa_correspondence_id INT NOT NULL UNIQUE,
  template_id       INT NULL, -- อ้างอิงถึงแม่แบบที่ใช้
  
  current_step_sequence INT NOT NULL DEFAULT 1,
  overall_status    ENUM('DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED') 
                    NOT NULL DEFAULT 'DRAFT',
  
  started_at        DATETIME NULL,
  completed_at      DATETIME NULL,
  
  CONSTRAINT fk_rwi_corr FOREIGN KEY (rfa_correspondence_id) 
    REFERENCES correspondences(corr_id) ON DELETE CASCADE,
  CONSTRAINT fk_rwi_template FOREIGN KEY (template_id) 
    REFERENCES technicaldoc_workflow_templates(template_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. RFA Workflow Steps (แยกจาก technicaldoc_workflows เดิม)
CREATE TABLE rfa_workflow_steps (
  step_id           INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id       INT NOT NULL,
  sequence          INT NOT NULL,
  org_id            INT NOT NULL,
  step_purpose      ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') 
                    NOT NULL DEFAULT 'FOR_APPROVAL',
  
  status            ENUM('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 
                         'APPROVED_WITH_COMMENTS', 'SKIPPED', 'RETURNED') 
                    NOT NULL DEFAULT 'PENDING',
  
  approve_code_id   INT NULL, -- Link to approve codes
  comments          TEXT NULL,
  
  activated_at      DATETIME NULL,
  processed_at      DATETIME NULL,
  processed_by_user_id INT NULL,
  
  deadline_date     DATE NULL,
  
  CONSTRAINT uq_workflow_sequence UNIQUE (workflow_id, sequence),
  
  CONSTRAINT fk_rws_workflow FOREIGN KEY (workflow_id) 
    REFERENCES rfa_workflow_instances(workflow_id) ON DELETE CASCADE,
  CONSTRAINT fk_rws_org FOREIGN KEY (org_id) 
    REFERENCES organizations(org_id),
  CONSTRAINT fk_rws_approve_code FOREIGN KEY (approve_code_id) 
    REFERENCES technicaldoc_approve_codes(approve_code_id),
  CONSTRAINT fk_rws_user FOREIGN KEY (processed_by_user_id) 
    REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. View: Current Technical Documents with Latest Revision
CREATE OR REPLACE VIEW v_current_technical_documents AS
SELECT 
  tdm.master_id,
  tdm.document_number,
  tdm.document_type_id,
  dt.code AS document_type_code,
  dt.name AS document_type_name,
  tdm.project_id,
  tdm.title,
  tdm.rfa_correspondence_id,
  tdr.revision_id,
  tdr.revision_number,
  tdr.revision_label,
  tdr.status_code_id,
  sc.code AS status_code,
  sc.description AS status_description,
  tdr.approve_code_id,
  ac.code AS approve_code,
  ac.description AS approve_description,
  tdr.pdf_path,
  tdr.dwg_path,
  tdr.submitted_date,
  tdr.approved_date,
  tdm.created_at,
  tdr.created_at AS revision_created_at
FROM technical_document_master tdm
INNER JOIN technical_document_revisions tdr 
  ON tdm.current_revision_id = tdr.revision_id
INNER JOIN technicaldoc_types dt 
  ON tdm.document_type_id = dt.document_types_id
LEFT JOIN technicaldoc_status_codes sc 
  ON tdr.status_code_id = sc.status_code_id
LEFT JOIN technicaldoc_approve_codes ac 
  ON tdr.approve_code_id = ac.approve_code_id
WHERE tdm.deleted_at IS NULL;


-- 8. View: RFA Workflow Status
CREATE OR REPLACE VIEW v_rfa_workflow_status AS
SELECT 
  rwi.workflow_id,
  rwi.rfa_correspondence_id,
  c.correspondence_number AS rfa_number,
  rwi.overall_status,
  rwi.current_step_sequence,
  rws.step_id AS current_step_id,
  rws.org_id AS current_org_id,
  o.org_name AS current_org_name,
  rws.status AS current_step_status,
  rws.deadline_date,
  rwi.started_at,
  DATEDIFF(CURDATE(), rwi.started_at) AS days_in_progress,
  (SELECT COUNT(*) FROM rfa_workflow_steps WHERE workflow_id = rwi.workflow_id) AS total_steps,
  (SELECT COUNT(*) FROM rfa_workflow_steps WHERE workflow_id = rwi.workflow_id AND status IN ('APPROVED','APPROVED_WITH_COMMENTS')) AS completed_steps
FROM rfa_workflow_instances rwi
INNER JOIN correspondences c ON rwi.rfa_correspondence_id = c.corr_id
LEFT JOIN rfa_workflow_steps rws 
  ON rwi.workflow_id = rws.workflow_id 
  AND rwi.current_step_sequence = rws.sequence
LEFT JOIN organizations o ON rws.org_id = o.org_id
WHERE rwi.overall_status NOT IN ('CANCELLED', 'APPROVED');