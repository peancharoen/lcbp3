// File: docs/ai-knowledge-base/checklists/db-change.md
# Checklist: Database Schema Changes

## 📝 Pre-Change
- [ ] เขียน SQL Delta script ตามเทมเพลตใน `templates/db-migration.md`
- [ ] มี Rollback script เตรียมไว้พร้อมใช้งาน
- [ ] ทดสอบรันใน Local/Development แล้ว
- [ ] ตรวจสอบว่าไม่กระทบต่อ Query เดิมในโค้ด (e.g. `SELECT *` อาจจะอันตราย)

## 🚀 Execution
- [ ] ทำการ Backup ฐานข้อมูลก่อนเริ่ม (ถ้าเป็น Production)
- [ ] รัน SQL Script ผ่านเครื่องมือที่กำหนด (e.g. DBeaver, HeidiSQL)
- [ ] ตรวจสอบโครงสร้างตารางหลังแก้ไข

## ✅ Verification
- [ ] รันระบบและทดสอบฟีเจอร์ที่เกี่ยวข้อง
- [ ] ตรวจสอบ Logs ว่าไม่มี SQL Error
- [ ] อัปเดตไฟล์ `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` ให้ตรงกัน

---
// Change Log:
// - 2026-05-14: Initial DB change checklist
