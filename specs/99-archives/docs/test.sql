-- 1. สร้าง Template ชื่อ "General Approval"
INSERT INTO correspondence_routing_templates (id, template_name, description, is_active)
VALUES (
        1,
        'General Approval',
        'Template สำหรับการอนุมัติทั่วไป',
        1
    );
-- 2. สร้าง Steps (ส่งไป Org ID 1 ก่อน แล้วส่งไป Org ID 2)
-- (สมมติว่า Org ID 1 = Owner, Org ID 2 = Consultant ตาม Seed Data เดิม)
INSERT INTO correspondence_routing_template_steps (
        template_id,
        sequence,
        to_organization_id,
        step_purpose,
        expected_days
    )
VALUES (1, 1, 22, 'FOR_REVIEW', 3),
    (1, 2, 1, 'FOR_APPROVAL', 5);