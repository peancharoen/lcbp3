-- Delta Rollback: ลบตาราง system_settings
-- Date: 2026-05-22
-- Related ADR: ADR-027
-- Applied in: v1.9.0 -> v1.9.5

-- ------------------------------------------------------------
-- การย้อนกลับโครงสร้างฐานข้อมูล (Rollback changes)
-- ------------------------------------------------------------

DROP TABLE IF EXISTS system_settings;
