-- File: specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql
-- Change Log:
-- - 2026-08-18: Initial delta for Tag Color Palette Key (Feature 243, ADR-046)
-- Description:
--   1. UPDATE tags.color_code ที่ไม่อยู่ใน palette key ให้เป็น 'default'
-- อ้างอิง: ADR-009 (schema delta ไม่ใช้ TypeORM migration), ADR-044 (formalize delta process),
--          ADR-046 (Tag Color Palette Key — color_code เป็น palette key enum)
--
-- หมายเหตุ:
--   - ไม่เปลี่ยน column type (ยังเป็น VARCHAR(30)) — เพราะ palette key ทั้ง 14 ตัวสั้นกว่า 30 อักขระ
--   - ไม่เพิ่ม CHECK constraint — MariaDB 11 รองรับ CHECK แต่ enforce ที่ application layer (DTO @IsIn) แล้ว
--   - DB ใน environment ปัจจุบันมี 0 rows (ตรวจสอบแล้วใน T001) — delta นี้รันเพื่อความปลอดภัยในกรณีที่มี environment อื่นมี legacy data
--   - ตาม ADR-044: รัน manual โดย DBA หลัง review — ไม่ auto-run ใน CI/CD
-- 1. แปลงค่า color_code ที่ไม่อยู่ใน palette key ให้เป็น 'default'
--    Palette keys ที่ valid (ADR-046): default, slate, red, orange, amber, yellow,
--    green, teal, blue, indigo, violet, purple, pink, rose
--    รวม NULL values ด้วย — เพราะ column เป็น nullable และ NULL NOT IN (...) คืน NULL (ไม่ match)
UPDATE tags
SET color_code = 'default'
WHERE color_code IS NULL
  OR color_code NOT IN (
    'default',
    'slate',
    'red',
    'orange',
    'amber',
    'yellow',
    'green',
    'teal',
    'blue',
    'indigo',
    'violet',
    'purple',
    'pink',
    'rose'
  );
