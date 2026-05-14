// File: docs/ai-knowledge-base/playbooks/dms/rfa-lifecycle.md
# Playbook: RFA Lifecycle Management

## 🔄 Lifecycle Stages
1. **Draft**: ผู้สร้างเตรียมเอกสารและอัปโหลดไฟล์
2. **Submitted**: ส่งเข้าระบบเพื่อรอการตรวจสอบ (Review)
3. **Reviewing**: ทีมที่ปรึกษาหรือหน่วยงานที่เกี่ยวข้องตรวจสอบ
4. **Responded**: ให้ความเห็น (Comment) กลับมา
5. **Approved / Rejected**: สถานะสุดท้ายของการอนุมัติ
6. **Closed**: สิ้นสุดกระบวนการ

## 🛡️ Business Rules (ADR-001)
- การเปลี่ยนสถานะต้องใช้ **Workflow Engine** เท่านั้น
- ต้องมีการทำ **Optimistic Locking** ผ่าน `@VersionColumn` เพื่อป้องกันการอนุมัติพร้อมกัน
- ทุกการเปลี่ยนสถานะต้องบันทึก **Audit Log** และ **Workflow History**
- หากมีการอัปโหลดไฟล์ใหม่ ต้องย้ายจาก `temp` ไป `permanent` และสแกน ClamAV

## 🛠️ Implementation Steps
1. ตรวจสอบสิทธิ์ผู้ใช้ผ่าน `CaslGuard`
2. ดึงข้อมูล RFA พร้อมสถานะปัจจุบันจาก DB
3. ตรวจสอบความถูกต้องของสถานะต้นทาง (Source State) และสถานะปลายทาง (Target State)
4. ทำการ Update ใน Database Transaction
5. ส่งการแจ้งเตือนผ่าน `BullMQ`

---
// Change Log:
// - 2026-05-14: Initial RFA lifecycle playbook
