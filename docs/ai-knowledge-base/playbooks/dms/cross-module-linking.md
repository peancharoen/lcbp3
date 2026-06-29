// File: docs/ai-knowledge-base/playbooks/dms/cross-module-linking.md
# Playbook: Cross-Module Linking (การเชื่อมโยงข้อมูลข้ามโมดูล)

## 🎯 Objective
รักษาความถูกต้องและความเชื่อมโยงของข้อมูล (Data Integrity) ระหว่างโมดูลต่างๆ เช่น การผูก RFA เข้ากับ Drawing หรือ Correspondence

## 🏗️ Linking Rules
1. **Use PublicId**: การเชื่อมโยงข้ามโมดูลต้องใช้ `publicId` (UUIDv7) เท่านั้น
2. **Atomic Updates**: หากการเชื่อมโยงส่งผลต่อสถานะของทั้งสองโมดูล ต้องทำภายใน Database Transaction เดียวกัน
3. **Audit Trail**: ต้องบันทึกประวัติการเชื่อมโยง (e.g. "Drawing X linked to RFA Y")
4. **Validation**: ก่อนสร้าง Link ต้องตรวจสอบว่าทั้งสอง Entity มีอยู่จริงและอยู่ในสถานะที่อนุญาตให้เชื่อมโยงได้

## 🛠️ Implementation Example
- **RFA to Drawing**: เมื่อ RFA ได้รับการอนุมัติ ให้ทำการอัปเดตสถานะของ Drawing ที่เกี่ยวข้องโดยอัตโนมัติ
- **Correspondence to Transmittal**: บันทึกว่าจดหมายฉบับนี้ถูกส่งไปพร้อมกับ Transmittal เลขที่เท่าไหร่

---
// Change Log:
// - 2026-05-14: Initial cross-module linking playbook
