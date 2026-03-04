-- ==========================================================
-- DMS v1.8.0 Schema Part 3/3: Views, Indexes, Partitioning
-- รัน: หลังจาก 02-schema-tables.sql เสร็จ
-- ==========================================================
SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- ============================================================
-- 5. PARTITIONING PREPARATION (Advance - Optional)
-- ============================================================
-- หมายเหตุ: การทำ Partitioning บนตารางที่มีอยู่แล้ว (audit_logs, notifications)
-- มักจะต้อง Drop Primary Key เดิม แล้วสร้างใหม่โดยรวม Partition Key (created_at) เข้าไป
-- ขั้นตอนนี้ควรทำแยกต่างหากเมื่อระบบเริ่มมีข้อมูลเยอะ หรือทำใน Maintenance Window
--
-- ตัวอย่าง SQL สำหรับ Audit Logs (Reference Only):
-- ALTER TABLE audit_logs DROP PRIMARY KEY, ADD PRIMARY KEY (audit_id, created_at);
-- ALTER TABLE audit_logs PARTITION BY RANGE (YEAR(created_at)) (
--    PARTITION p2024 VALUES LESS THAN (2025),
--    PARTITION p2025 VALUES LESS THAN (2026),
--    PARTITION p_future VALUES LESS THAN MAXVALUE
-- );
-- =====================================================
-- CREATE INDEXES
-- =====================================================
-- Indexes for correspondences
CREATE INDEX idx_corr_type ON correspondences(correspondence_type_id);

CREATE INDEX idx_corr_project ON correspondences(project_id);

CREATE INDEX idx_rfa_rev_v_drawing_count ON rfa_revisions (v_ref_drawing_count);

-- Indexes for document_number_formats
CREATE INDEX idx_document_number_formats_project ON document_number_formats (project_id);

CREATE INDEX idx_document_number_formats_type ON document_number_formats (correspondence_type_id);

CREATE INDEX idx_document_number_formats_project_type ON document_number_formats (project_id, correspondence_type_id);

-- Indexes for document_number_counters
CREATE INDEX idx_document_number_counters_project ON document_number_counters (project_id);

CREATE INDEX idx_document_number_counters_org ON document_number_counters (originator_organization_id);

CREATE INDEX idx_document_number_counters_type ON document_number_counters (correspondence_type_id);

-- Indexes for tags
CREATE INDEX idx_tags_name ON tags (tag_name);

CREATE INDEX idx_tags_created_at ON tags (created_at);

-- Indexes for correspondence_tags
CREATE INDEX idx_correspondence_tags_correspondence ON correspondence_tags (correspondence_id);

CREATE INDEX idx_correspondence_tags_tag ON correspondence_tags (tag_id);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);

CREATE INDEX idx_audit_logs_action ON audit_logs (ACTION);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX idx_audit_logs_ip ON audit_logs (ip_address);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications (user_id);

CREATE INDEX idx_notifications_type ON notifications (notification_type);

CREATE INDEX idx_notifications_read ON notifications (is_read);

CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id);

CREATE INDEX idx_notifications_created_at ON notifications (created_at);

-- Indexes for search_indices
CREATE INDEX idx_search_indices_entity ON search_indices (entity_type, entity_id);

CREATE INDEX idx_search_indices_indexed_at ON search_indices (indexed_at);

-- Indexes for backup_logs
CREATE INDEX idx_backup_logs_type ON backup_logs (backup_type);

CREATE INDEX idx_backup_logs_status ON backup_logs (STATUS);

CREATE INDEX idx_backup_logs_started_at ON backup_logs (started_at);

CREATE INDEX idx_backup_logs_completed_at ON backup_logs (completed_at);

-- =====================================================
-- Additional Composite Indexes for Performance
-- =====================================================
-- Composite index for document_number_counters for faster lookups
-- Composite index for notifications for user-specific queries
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at);

-- Composite index for audit_logs for reporting
CREATE INDEX idx_audit_logs_reporting ON audit_logs (created_at, entity_type, ACTION);

-- Composite index for search_indices for entity-based queries
CREATE INDEX idx_search_entities ON search_indices (entity_type, entity_id, indexed_at);

-- สร้าง Index สำหรับ Cleanup Job
CREATE INDEX idx_attachments_temp_cleanup ON attachments (is_temporary, expires_at);

CREATE INDEX idx_attachments_temp_id ON attachments (temp_id);

CREATE INDEX idx_audit_request_id ON audit_logs (request_id);

-- =====================================================
-- SQL Script for LCBP3-DMS (V1.4.0) - MariaDB
-- Generated from Data Dictionary
-- =====================================================
-- =====================================================
-- 11. 📊 Views & Procedures (วิว และ โปรซีเดอร์)
-- =====================================================
-- View แสดง Revision "ปัจจุบัน" ของ correspondences ทั้งหมด (ที่ไม่ใช่ RFA)
CREATE VIEW v_current_correspondences AS
SELECT c.id AS correspondence_id,
  c.correspondence_number,
  c.correspondence_type_id,
  ct.type_code AS correspondence_type_code,
  ct.type_name AS correspondence_type_name,
  c.project_id,
  p.project_code,
  p.project_name,
  c.originator_id,
  org.organization_code AS originator_code,
  org.organization_name AS originator_name,
  cr.id AS revision_id,
  cr.revision_number,
  cr.revision_label,
  cr.subject,
  cr.document_date,
  cr.issued_date,
  cr.received_date,
  cr.due_date,
  cr.correspondence_status_id,
  cs.status_code,
  cs.status_name,
  cr.created_by,
  u.username AS created_by_username,
  cr.created_at AS revision_created_at
FROM correspondences c
  INNER JOIN correspondence_types ct ON c.correspondence_type_id = ct.id
  INNER JOIN projects p ON c.project_id = p.id
  LEFT JOIN organizations org ON c.originator_id = org.id
  INNER JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
  INNER JOIN correspondence_status cs ON cr.correspondence_status_id = cs.id
  LEFT JOIN users u ON cr.created_by = u.user_id
WHERE cr.is_current = TRUE
  AND c.correspondence_type_id NOT IN(
    SELECT id
    FROM correspondence_types
    WHERE type_code = 'RFA'
  )
  AND c.deleted_at IS NULL;

-- View แสดง Revision "ปัจจุบัน" ของ rfa_revisions ทั้งหมด
CREATE VIEW v_current_rfas AS
SELECT r.id AS rfa_id,
  r.rfa_type_id,
  rt.type_code AS rfa_type_code,
  rt.type_name_th AS rfa_type_name_th,
  rt.type_name_en AS rfa_type_name_en,
  c.correspondence_number,
  c.discipline_id,
  -- ✅ ดึงจาก Correspondences
  d.discipline_code,
  -- ✅ Join เพิ่มเพื่อแสดง code
  c.project_id,
  p.project_code,
  p.project_name,
  c.originator_id,
  org.organization_name AS originator_name,
  rr.id AS revision_id,
  rr.revision_number,
  rr.revision_label,
  rr.subject,
  rr.document_date,
  rr.issued_date,
  rr.received_date,
  rr.approved_date,
  rr.rfa_status_code_id,
  rsc.status_code AS rfa_status_code,
  rsc.status_name AS rfa_status_name,
  rr.rfa_approve_code_id,
  rac.approve_code AS rfa_approve_code,
  rac.approve_name AS rfa_approve_name,
  rr.created_by,
  u.username AS created_by_username,
  rr.created_at AS revision_created_at
FROM rfas r
  INNER JOIN rfa_types rt ON r.rfa_type_id = rt.id
  INNER JOIN rfa_revisions rr ON r.id = rr.rfa_id -- RFA uses shared primary key with correspondences (1:1)
  INNER JOIN correspondences c ON r.id = c.id -- [FIX 1] เพิ่มการ Join ตาราง disciplines
  LEFT JOIN disciplines d ON c.discipline_id = d.id
  INNER JOIN projects p ON c.project_id = p.id
  INNER JOIN organizations org ON c.originator_id = org.id
  INNER JOIN rfa_status_codes rsc ON rr.rfa_status_code_id = rsc.id
  LEFT JOIN rfa_approve_codes rac ON rr.rfa_approve_code_id = rac.id
  LEFT JOIN users u ON rr.created_by = u.user_id
WHERE rr.is_current = TRUE
  AND r.deleted_at IS NULL
  AND c.deleted_at IS NULL;

-- View แสดงความสัมพันธ์ทั้งหมดระหว่าง Contract, Project, และ Organization
CREATE VIEW v_contract_parties_all AS
SELECT c.id AS contract_id,
  c.contract_code,
  c.contract_name,
  p.id AS project_id,
  p.project_code,
  p.project_name,
  o.id AS organization_id,
  o.organization_code,
  o.organization_name,
  co.role_in_contract
FROM contracts c
  INNER JOIN projects p ON c.project_id = p.id
  INNER JOIN contract_organizations co ON c.id = co.contract_id
  INNER JOIN organizations o ON co.organization_id = o.id
WHERE c.is_active = TRUE;

-- ============================================================
-- View: v_user_tasks (Unified Workflow Engine Edition)
-- ============================================================
-- หน้าที่: รวมรายการงานที่ยังค้างอยู่ (Status = ACTIVE) จากทุกระบบ (RFA, Circulation, Correspondence)
-- เพื่อนำไปแสดงในหน้า Dashboard "My Tasks"
-- ============================================================
CREATE OR REPLACE VIEW v_user_tasks AS
SELECT -- 1. Workflow Instance Info
  wi.id AS instance_id,
  wd.workflow_code,
  wi.current_state,
  wi.status AS workflow_status,
  wi.created_at AS assigned_at,
  -- 2. Entity Info (Polymorphic Identity)
  wi.entity_type,
  wi.entity_id,
  -- 3. Normalized Document Info (ดึงข้อมูลจริงจากตารางลูกตามประเภท)
  -- ใช้ CASE WHEN เพื่อรวมคอลัมน์ที่ชื่อต่างกันให้เป็นชื่อกลาง (document_number, subject)
  CASE
    WHEN wi.entity_type = 'rfa_revision' THEN rfa_corr.correspondence_number
    WHEN wi.entity_type = 'circulation' THEN circ.circulation_no
    WHEN wi.entity_type = 'correspondence_revision' THEN corr_corr.correspondence_number
    ELSE 'N/A'
  END AS document_number,
  CASE
    WHEN wi.entity_type = 'rfa_revision' THEN rfa_rev.subject
    WHEN wi.entity_type = 'circulation' THEN circ.circulation_subject
    WHEN wi.entity_type = 'correspondence_revision' THEN corr_rev.subject
    ELSE 'Unknown Document'
  END AS subject,
  -- 4. Context Info (สำหรับ Filter สิทธิ์การมองเห็นที่ Backend)
  -- ดึงเป็น JSON String เพื่อให้ Backend ไป Parse หรือใช้ JSON_CONTAINS
  JSON_UNQUOTE(JSON_EXTRACT(wi.context, '$.ownerId')) AS owner_id,
  JSON_EXTRACT(wi.context, '$.assigneeIds') AS assignee_ids_json
FROM workflow_instances wi
  JOIN workflow_definitions wd ON wi.definition_id = wd.id -- 5. Joins for RFA (ซับซ้อนหน่อยเพราะ RFA ผูกกับ Correspondence อีกที)
  LEFT JOIN rfa_revisions rfa_rev ON wi.entity_type = 'rfa_revision'
  AND wi.entity_id = CAST(rfa_rev.id AS CHAR)
  LEFT JOIN correspondences rfa_corr ON rfa_rev.id = rfa_corr.id -- 6. Joins for Circulation
  LEFT JOIN circulations circ ON wi.entity_type = 'circulation'
  AND wi.entity_id = CAST(circ.id AS CHAR) -- 7. Joins for Correspondence
  LEFT JOIN correspondence_revisions corr_rev ON wi.entity_type = 'correspondence_revision'
  AND wi.entity_id = CAST(corr_rev.id AS CHAR)
  LEFT JOIN correspondences corr_corr ON corr_rev.correspondence_id = corr_corr.id -- 8. Filter เฉพาะงานที่ยัง Active อยู่
WHERE wi.status = 'ACTIVE';

-- View แสดง audit_logs พร้อมข้อมูล username และ email ของผู้กระทำ
CREATE VIEW v_audit_log_details AS
SELECT al.audit_id,
  al.user_id,
  u.username,
  u.email,
  u.first_name,
  u.last_name,
  al.action,
  al.entity_type,
  al.entity_id,
  al.details_json,
  al.ip_address,
  al.user_agent,
  al.created_at
FROM audit_logs al
  LEFT JOIN users u ON al.user_id = u.user_id;

-- View รวมสิทธิ์ทั้งหมด (Global + Project) ของผู้ใช้ทุกคน
CREATE VIEW v_user_all_permissions AS -- Global Permissions
SELECT ua.user_id,
  ua.role_id,
  r.role_name,
  rp.permission_id,
  p.permission_name,
  p.module,
  p.scope_level,
  ua.organization_id,
  NULL AS project_id,
  NULL AS contract_id,
  'GLOBAL' AS permission_scope
FROM user_assignments ua
  INNER JOIN roles r ON ua.role_id = r.role_id
  INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
  INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Global scope
WHERE p.is_active = 1
  AND ua.organization_id IS NULL
  AND ua.project_id IS NULL
  AND ua.contract_id IS NULL
UNION ALL
-- Organization-specific Permissions
SELECT ua.user_id,
  ua.role_id,
  r.role_name,
  rp.permission_id,
  p.permission_name,
  p.module,
  p.scope_level,
  ua.organization_id,
  NULL AS project_id,
  NULL AS contract_id,
  'ORGANIZATION' AS permission_scope
FROM user_assignments ua
  INNER JOIN roles r ON ua.role_id = r.role_id
  INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
  INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Organization scope
WHERE p.is_active = 1
  AND ua.organization_id IS NOT NULL
  AND ua.project_id IS NULL
  AND ua.contract_id IS NULL
UNION ALL
-- Project-specific Permissions
SELECT ua.user_id,
  ua.role_id,
  r.role_name,
  rp.permission_id,
  p.permission_name,
  p.module,
  p.scope_level,
  ua.organization_id,
  ua.project_id,
  NULL AS contract_id,
  'PROJECT' AS permission_scope
FROM user_assignments ua
  INNER JOIN roles r ON ua.role_id = r.role_id
  INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
  INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Project scope
WHERE p.is_active = 1
  AND ua.project_id IS NOT NULL
  AND ua.contract_id IS NULL
UNION ALL
-- Contract-specific Permissions
SELECT ua.user_id,
  ua.role_id,
  r.role_name,
  rp.permission_id,
  p.permission_name,
  p.module,
  p.scope_level,
  ua.organization_id,
  ua.project_id,
  ua.contract_id,
  'CONTRACT' AS permission_scope
FROM user_assignments ua
  INNER JOIN roles r ON ua.role_id = r.role_id
  INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
  INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Contract scope
WHERE p.is_active = 1
  AND ua.contract_id IS NOT NULL;

-- =====================================================
-- Additional Useful Views
-- =====================================================
-- View แสดงเอกสารทั้งหมดที่มีไฟล์แนบ
CREATE VIEW v_documents_with_attachments AS
SELECT 'CORRESPONDENCE' AS document_type,
  c.id AS document_id,
  c.correspondence_number AS document_number,
  c.project_id,
  p.project_code,
  p.project_name,
  COUNT(ca.attachment_id) AS attachment_count,
  MAX(a.created_at) AS latest_attachment_date
FROM correspondences c
  INNER JOIN projects p ON c.project_id = p.id
  LEFT JOIN correspondence_attachments ca ON c.id = ca.correspondence_id
  LEFT JOIN attachments a ON ca.attachment_id = a.id
WHERE c.deleted_at IS NULL
GROUP BY c.id,
  c.correspondence_number,
  c.project_id,
  p.project_code,
  p.project_name
UNION ALL
SELECT 'CIRCULATION' AS document_type,
  circ.id AS document_id,
  circ.circulation_no AS document_number,
  corr.project_id,
  p.project_code,
  p.project_name,
  COUNT(ca.attachment_id) AS attachment_count,
  MAX(a.created_at) AS latest_attachment_date
FROM circulations circ
  INNER JOIN correspondences corr ON circ.correspondence_id = corr.id
  INNER JOIN projects p ON corr.project_id = p.id
  LEFT JOIN circulation_attachments ca ON circ.id = ca.circulation_id
  LEFT JOIN attachments a ON ca.attachment_id = a.id
GROUP BY circ.id,
  circ.circulation_no,
  corr.project_id,
  p.project_code,
  p.project_name
UNION ALL
SELECT 'SHOP_DRAWING' AS document_type,
  sdr.id AS document_id,
  sd.drawing_number AS document_number,
  sd.project_id,
  p.project_code,
  p.project_name,
  COUNT(sdra.attachment_id) AS attachment_count,
  MAX(a.created_at) AS latest_attachment_date
FROM shop_drawing_revisions sdr
  INNER JOIN shop_drawings sd ON sdr.shop_drawing_id = sd.id
  INNER JOIN projects p ON sd.project_id = p.id
  LEFT JOIN shop_drawing_revision_attachments sdra ON sdr.id = sdra.shop_drawing_revision_id
  LEFT JOIN attachments a ON sdra.attachment_id = a.id
WHERE sd.deleted_at IS NULL
GROUP BY sdr.id,
  sd.drawing_number,
  sd.project_id,
  p.project_code,
  p.project_name
UNION ALL
SELECT 'CONTRACT_DRAWING' AS document_type,
  cd.id AS document_id,
  cd.condwg_no AS document_number,
  cd.project_id,
  p.project_code,
  p.project_name,
  COUNT(cda.attachment_id) AS attachment_count,
  MAX(a.created_at) AS latest_attachment_date
FROM contract_drawings cd
  INNER JOIN projects p ON cd.project_id = p.id
  LEFT JOIN contract_drawing_attachments cda ON cd.id = cda.contract_drawing_id
  LEFT JOIN attachments a ON cda.attachment_id = a.id
WHERE cd.deleted_at IS NULL
GROUP BY cd.id,
  cd.condwg_no,
  cd.project_id,
  p.project_code,
  p.project_name;

-- View แสดงสถิติเอกสารตามประเภทและสถานะ
CREATE VIEW v_document_statistics AS
SELECT p.id AS project_id,
  p.project_code,
  p.project_name,
  ct.id AS correspondence_type_id,
  ct.type_code,
  ct.type_name,
  cs.id AS status_id,
  cs.status_code,
  cs.status_name,
  COUNT(DISTINCT c.id) AS document_count,
  COUNT(DISTINCT cr.id) AS revision_count
FROM projects p
  CROSS JOIN correspondence_types ct
  CROSS JOIN correspondence_status cs
  LEFT JOIN correspondences c ON p.id = c.project_id
  AND ct.id = c.correspondence_type_id
  LEFT JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
  AND cs.id = cr.correspondence_status_id
  AND cr.is_current = TRUE
WHERE p.is_active = 1
  AND ct.is_active = 1
  AND cs.is_active = 1
GROUP BY p.id,
  p.project_code,
  p.project_name,
  ct.id,
  ct.type_code,
  ct.type_name,
  cs.id,
  cs.status_code,
  cs.status_name;

-- =====================================================
-- Indexes for View Performance Optimization
-- =====================================================
-- Indexes for v_current_correspondences performance
CREATE INDEX idx_correspondences_type_project ON correspondences (correspondence_type_id, project_id);

CREATE INDEX idx_corr_revisions_current_status ON correspondence_revisions (is_current, correspondence_status_id);

CREATE INDEX idx_corr_revisions_correspondence_current ON correspondence_revisions (correspondence_id, is_current);

-- Indexes for v_current_rfas performance
CREATE INDEX idx_rfa_revisions_current_status ON rfa_revisions (is_current, rfa_status_code_id);

CREATE INDEX idx_rfa_revisions_rfa_current ON rfa_revisions (rfa_id, is_current);

-- Indexes for document statistics performance
CREATE INDEX idx_correspondences_project_type ON correspondences (project_id, correspondence_type_id);

CREATE INDEX idx_corr_revisions_status_current ON correspondence_revisions (correspondence_status_id, is_current);

CREATE INDEX IDX_AUDIT_DOC_ID ON document_number_audit (document_id);

CREATE INDEX IDX_AUDIT_STATUS ON document_number_audit (STATUS);

CREATE INDEX IDX_AUDIT_OPERATION ON document_number_audit (operation);

SET FOREIGN_KEY_CHECKS = 1;

