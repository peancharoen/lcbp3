// File: docs/ai-knowledge-base/playbooks/dms/transmittal-process.md
# Playbook: Transmittal Process

## 🔄 Transmittal Workflow
1. **Creation**: DC (Document Control) สร้าง Transmittal และเลือกเอกสาร (Attachments) ที่ต้องการส่ง
2. **Review**: หัวหน้าทีมตรวจสอบความถูกต้องของรายการเอกสาร
3. **Issuance**: ส่งมอบเอกสารอย่างเป็นทางการ (เปลี่ยนสถานะเป็น Issued)
4. **Acknowledgment**: ผู้รับเซ็นรับเอกสารในระบบ (เปลี่ยนสถานะเป็น Received)

## 📋 Standard Actions
- **Generate Cover Sheet**: ระบบสร้าง PDF หน้าปกที่มีรายการเอกสารและ QR Code
- **Link Documents**: เอกสารที่ถูกส่งจะถูกบันทึกความเชื่อมโยง (Link) กับ Transmittal ID
- **Notification**: ส่งอีเมลแจ้งเตือนผู้รับพร้อมลิงก์ดาวน์โหลด

---
// Change Log:
// - 2026-05-14: Initial transmittal process playbook
