# Session — 2026-06-19 (SQL Delta Consolidation)

## Summary

รวม SQL delta files ที่ apply แล้วเข้ากับ schema และ seed files หลัก, ลบ rollback files, อัปเดต data dictionary, และย้าย INSERT statements จาก schema file ไป seed file

## ปัญหาที่พบ (Root Cause)

ไม่มีปัญหา - เป็นงาน maintenance ปกติ

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | อัปเดต `tags`, `correspondence_tags`, `system_settings`, `migration_review_queue`, `ai_audit_logs` tables; เพิ่ม `ai_available_models`, `ai_prompts`, `ai_execution_profiles`, `ai_sandbox_profiles`, `migration_errors` tables; ลบ INSERT statements |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-basic.sql` | เพิ่ม AI seed data (ai_available_models, ai_execution_profiles, ai_sandbox_profiles); เพิ่ม system_settings INSERT statements |
| `specs/03-Data-and-Storage/03-01-data-dictionary.md` | อัปเดต version เป็น 1.9.2; อัปเดต `ai_audit_logs` definition; เพิ่ม entries สำหรับ `ai_available_models`, `ai_prompts`, `ai_execution_profiles`, `ai_sandbox_profiles`, `migration_errors` |
| `specs/03-Data-and-Storage/deltas/` | ลบ rollback files 15 ไฟล์และ .sql files 26 ไฟล์ทั้งหมด |

## กฎที่ Lock แล้ว

- **Schema Management**: ใช้ ADR-009 (no migrations) - แก้ SQL schema โดยตรง และใช้ delta files สำหรับ tracking
- **Seed Data Separation**: INSERT statements ต้องอยู่ใน seed files ไม่ใช่ schema files
- **Data Dictionary Sync**: เมื่อแก้ schema ต้องอัปเดต data dictionary พร้อม version bump

## Verification

- [x] Schema file ไม่มี INSERT statements
- [x] Seed file มี system_settings INSERT statements
- [x] AI seed data ถูกเพิ่มใน seed-basic.sql
- [x] Data dictionary version ถูก bump เป็น 1.9.2
- [x] Delta directory ถูก clean up (เหลือเฉพาะ README.md)
