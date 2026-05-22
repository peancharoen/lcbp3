-- File: specs/03-Data-and-Storage/deltas/2026-05-22-create-tags-tables.rollback.sql
-- Change Log:
-- - 2026-05-22: ย้อนกลับตาราง tags และ correspondence_tags ตาม ADR-028

-- Delta Rollback: ลบตาราง tags และ correspondence_tags
-- Date: 2026-05-22
-- Related ADR: ADR-028

-- ------------------------------------------------------------
-- การลบตาราง (Rollback changes)
-- ------------------------------------------------------------

DROP TABLE IF EXISTS correspondence_tags;
DROP TABLE IF EXISTS tags;
