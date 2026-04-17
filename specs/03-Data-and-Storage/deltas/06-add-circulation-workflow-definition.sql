-- ==========================================================
-- Delta 06: Add CIRCULATION_FLOW_V1 Workflow Definition
-- ==========================================================
-- Purpose  : สร้าง Workflow Definition สำหรับใบเวียนภายใน (Circulation)
-- Required : ก่อน delta นี้ ตาราง workflow_definitions ต้องมีอยู่แล้ว (ADR-001)
-- Renamed  : CIRCULATION_INTERNAL_V1 → CIRCULATION_FLOW_V1 (ตาม naming convention)
-- States   :
--   DRAFT    (initial) → START → ROUTING
--   ROUTING            → COMPLETE    → COMPLETED (terminal)
--   ROUTING            → FORCE_CLOSE → CANCELLED (terminal)
-- ==========================================================

INSERT INTO `workflow_definitions` (
    `id`,
    `workflow_code`,
    `version`,
    `description`,
    `dsl`,
    `compiled`,
    `is_active`,
    `created_at`,
    `updated_at`
  )
VALUES (
    UUID(),
    'CIRCULATION_FLOW_V1',
    1,
    'Circulation Workflow — DRAFT → ROUTING → COMPLETED | CANCELLED',
    JSON_OBJECT(
      'workflow', 'CIRCULATION_FLOW_V1',
      'version', 1,
      'states', JSON_ARRAY(
        JSON_OBJECT(
          'name', 'DRAFT',
          'initial', TRUE,
          'on', JSON_OBJECT(
            'START', JSON_OBJECT('to', 'ROUTING')
          )
        ),
        JSON_OBJECT(
          'name', 'ROUTING',
          'on', JSON_OBJECT(
            'COMPLETE',    JSON_OBJECT('to', 'COMPLETED'),
            'FORCE_CLOSE', JSON_OBJECT('to', 'CANCELLED')
          )
        ),
        JSON_OBJECT('name', 'COMPLETED', 'terminal', TRUE),
        JSON_OBJECT('name', 'CANCELLED', 'terminal', TRUE)
      )
    ),
    JSON_OBJECT(
      'initialState', 'DRAFT',
      'states', JSON_OBJECT(
        'DRAFT', JSON_OBJECT(
          'initial', TRUE,
          'terminal', FALSE,
          'transitions', JSON_OBJECT(
            'START', JSON_OBJECT('to', 'ROUTING', 'events', JSON_ARRAY())
          )
        ),
        'ROUTING', JSON_OBJECT(
          'initial', FALSE,
          'terminal', FALSE,
          'transitions', JSON_OBJECT(
            'COMPLETE',    JSON_OBJECT('to', 'COMPLETED', 'events', JSON_ARRAY()),
            'FORCE_CLOSE', JSON_OBJECT('to', 'CANCELLED',  'events', JSON_ARRAY())
          )
        ),
        'COMPLETED', JSON_OBJECT(
          'initial', FALSE,
          'terminal', TRUE,
          'transitions', JSON_OBJECT()
        ),
        'CANCELLED', JSON_OBJECT(
          'initial', FALSE,
          'terminal', TRUE,
          'transitions', JSON_OBJECT()
        )
      )
    ),
    TRUE,
    NOW(),
    NOW()
  );

-- Verify
-- SELECT workflow_code, version, is_active FROM workflow_definitions WHERE workflow_code = 'CIRCULATION_FLOW_V1';
