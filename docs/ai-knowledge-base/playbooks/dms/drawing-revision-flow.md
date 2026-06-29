// File: docs/ai-knowledge-base/playbooks/dms/drawing-revision-flow.md
# Playbook: Drawing Revision Management

## 🔄 Revision Flow
1. **Initial Upload**: Drawing ถูกอัปโหลดเข้าระบบครั้งแรก (Revision 0 หรือ A)
2. **Review & Approval**: ผ่านกระบวนการ RFA
3. **Revision Up**: เมื่อมีการแก้ไข ให้ผู้ใช้อัปโหลดไฟล์ใหม่โดยอ้างอิง `publicId` เดิม
4. **Auto-Numbering**: ระบบจะเจนเลขที่ Revision ถัดไปตาม Rule (e.g. 0 -> 1 หรือ A -> B)
5. **Supersede**: Revision เก่าจะถูกทำเครื่องหมายเป็น "Superseded" (แต่ไฟล์ยังอยู่สำหรับการตรวจสอบย้อนหลัง)

## 🏗️ Technical Implementation
- ใช้ **Redis Redlock** ในการจองเลขที่ Revision เพื่อป้องกันเลขซ้ำ
- เก็บประวัติทั้งหมดไว้ใน `drawing_revisions` table
- แสดงเฉพาะ Revision ล่าสุด (Current) ในหน้ารายการหลัก ยกเว้นผู้ใช้จะเลือกดู History

---
// Change Log:
// - 2026-05-14: Initial drawing revision playbook
