// File: docs/ai-knowledge-base/checklists/security-audit.md
# Checklist: Security & Tier 1 Audit

## 🛡️ Authentication & Authorization
- [ ] ทุก API มี `@UseGuards(CaslGuard)`
- [ ] ทุก Action มีการตรวจสอบสิทธิ์ผ่าน `@CheckPolicies(...)`
- [ ] ไม่มีช่องโหว่ BOLA (Broken Object Level Authorization) - เช็คความเป็นเจ้าของข้อมูล
- [ ] JWT Payload ไม่มีข้อมูลส่วนตัวที่อ่อนไหว

## 🆔 Data Integrity (ADR-019)
- [ ] ใช้ `publicId` (UUIDv7) สำหรับ API/URL เท่านั้น
- [ ] ไม่มีโค้ดที่ใช้ `parseInt()` กับ UUID
- [ ] `id` (Integer) ถูก `@Exclude()` ออกจาก API Response

## 💾 Storage & Input
- [ ] ไฟล์ที่อัปโหลดถูกสแกน ClamAV ก่อนย้ายเข้า Permanent Storage
- [ ] มีการทำ Input Validation ทั้งฝั่ง Client (Zod) และ Server (class-validator)
- [ ] มีการใช้ `DOMPurify` หรือมาตรการป้องกัน XSS สำหรับข้อมูลที่แสดงผลเป็น HTML

## ⚙️ Concurrency & Reliability
- [ ] ใช้ Redis Redlock สำหรับ Document Numbering (ADR-002)
- [ ] ใช้ `@VersionColumn` สำหรับ Optimistic Locking ในจุดที่มีการแก้ไขพร้อมกัน
- [ ] งานที่ใช้เวลานานถูกส่งเข้า BullMQ (ADR-008)

---
// Change Log:
// - 2026-05-14: Initial security audit checklist
