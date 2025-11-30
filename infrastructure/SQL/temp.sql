SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS=0;

-- ==========================================================
-- 1. ลบ Stored Procedure เก่า (ย้าย Logic ไป NestJS)
-- ==========================================================
-- ตรรกะนี้ (การสร้าง Revision) จะถูกย้ายไปจัดการใน
-- CorrespondenceService และ RfaService ของ NestJS
DROP PROCEDURE IF EXISTS sp_create_correspondence_revision;


-- ==========================================================
-- 2. สร้าง Stored Procedure ใหม่ (สำหรับ Document Numbering)
-- ==========================================================
-- ใช้ Procedure นี้เพื่อจัดการ Race Condition
-- ในการดึงเลขที่เอกสารล่าสุด
-- ----------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE sp_get_next_document_number(
  IN p_project_id INT,
  IN p_organization_id INT,
  IN p_type_id INT,
  IN p_year INT,
  OUT p_next_number INT
)
BEGIN
  DECLARE v_last_number INT;

  -- 1. พยายามดึงแถวปัจจุบันและ "ล็อก" (FOR UPDATE)
  -- เพื่อป้องกันไม่ให้ Transaction อื่นอ่านค่านี้จนกว่าเราจะเสร็จ
  SELECT last_number
  INTO v_last_number
  FROM document_number_counters
  WHERE
    project_id = p_project_id AND
    originator_organization_id = p_organization_id AND
    correspondence_type_id = p_type_id AND
    current_year = p_year
  FOR UPDATE;

  -- 2. ตรวจสอบว่าพบบแถวหรือไม่
  IF v_last_number IS NULL THEN
    -- 2a. ไม่พบ (นี่คือเลขที่ "1" ของ Key นี้)
    INSERT INTO document_number_counters
      (project_id, originator_organization_id, correspondence_type_id, current_year, last_number)
    VALUES
      (p_project_id, p_organization_id, p_type_id, p_year, 1);
    
    SET p_next_number = 1;
  ELSE
    -- 2b. พบ (บวกเลขที่เดิม)
    SET p_next_number = v_last_number + 1;
    
    UPDATE document_number_counters
    SET last_number = p_next_number
    WHERE
      project_id = p_project_id AND
      originator_organization_id = p_organization_id AND
      correspondence_type_id = p_type_id AND
      current_year = p_year;
  END IF;

  -- (Transaction จะ Commit อัตโนมัติเมื่อ Procedure จบ)
END$$
DELIMITER ;


-- ==========================================================
-- 3. สร้าง Views (สำหรับช่วย Backend/Frontend)
-- ==========================================================

-- ----------------------------------------------------------
-- View 1: v_user_tasks (สำหรับ Dashboard "งานของฉัน" Req 5.3)
-- ----------------------------------------------------------
CREATE OR REPLACE VIEW v_user_tasks AS
SELECT 
  ca.user_id,
  c.id AS circulation_id,
  c.organization_id,
  c.circulation_no,
  c.circulation_subject,
  ca.assignee_type,
  ca.deadline,
  c.created_at,
  c.correspondence_id
FROM circulations c
JOIN circulation_assignees ca ON c.id = ca.circulation_id
WHERE 
  ca.is_completed = FALSE 
  AND ca.assignee_type IN ('MAIN', 'ACTION');


-- ----------------------------------------------------------
-- View 2: v_audit_log_details (สำหรับ Activity Feed Req 6.1)
-- ----------------------------------------------------------
CREATE OR REPLACE VIEW v_audit_log_details AS
SELECT 
  al.audit_id,
  al.user_id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.details_json,
  al.ip_address,
  al.created_at,
  u.username,
  u.first_name,
  u.last_name,
  u.email
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.user_id;


-- ----------------------------------------------------------
-- View 3: v_user_all_permissions (สำหรับ RBAC 2 ระดับ Req 4.2)
-- ----------------------------------------------------------
-- View นี้จะรวมสิทธิ์ 2 ระดับ (Global และ Project)
-- (หมายเหตุ: ไม่รวม Contract-level เนื่องจากยังไม่มีตาราง)
-- ----------------------------------------------------------
CREATE OR REPLACE VIEW v_user_all_permissions AS
-- 1. สิทธิ์ระดับ Global (project_id IS NULL)
SELECT 
  ur.user_id,
  NULL AS project_id,
  p.permission_code
FROM user_roles ur
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.permission_id

UNION

-- 2. สิทธิ์ระดับ Project
SELECT 
  upr.user_id,
  upr.project_id,
  p.permission_code
FROM user_project_roles upr
JOIN role_permissions rp ON upr.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.permission_id;


SET FOREIGN_KEY_CHECKS=1;