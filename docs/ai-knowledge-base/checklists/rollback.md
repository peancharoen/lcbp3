// File: docs/ai-knowledge-base/checklists/rollback.md
# Checklist: System Rollback (Emergency)

## 🚨 Decision Point
- [ ] ระบบล่มถาวรเกิน 15 นาที
- [ ] พบช่องโหว่ความปลอดภัยที่สำคัญ
- [ ] ข้อมูลสูญหายหรือเสียหายจากการทำงานผิดพลาด

## 🛠️ Execution (Code)
- [ ] Revert Git Commit ไปยัง Tag หรือ Hash ที่เสถียรล่าสุด
- [ ] Trigger CI/CD เพื่อ Deploy เวอร์ชันเก่า
- [ ] เคลียร์ Cache ใน Redis (ถ้าจำเป็น)

## 🗄️ Execution (Database)
- [ ] รัน Rollback SQL script
- [ ] หากรุนแรง ให้ Restore ข้อมูลจาก Backup ล่าสุด

## ✅ Verification
- [ ] ตรวจสอบว่าระบบกลับมาออนไลน์
- [ ] แจ้งทีมที่เกี่ยวข้องเรื่องเหตุการณ์ (Incident Report)

---
// Change Log:
// - 2026-05-14: Initial rollback checklist
