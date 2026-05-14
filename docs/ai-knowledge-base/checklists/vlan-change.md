// File: docs/ai-knowledge-base/checklists/vlan-change.md
# Checklist: VLAN Configuration Changes

## 📝 Planning
- [ ] กำหนด VLAN ID และ Subnet ที่ต้องการ
- [ ] ตรวจสอบความซ้ำซ้อนของ IP ในเครือข่ายเดิม
- [ ] วางแผน Port Profile ใน Omada

## 🚀 Configuration
- [ ] สร้าง VLAN ใน Omada Controller
- [ ] ตั้งค่า Port Profile ให้กับ Switch ที่เกี่ยวข้อง
- [ ] ทดสอบการเชื่อมต่อจาก Client (DHCP/Static IP)

## ✅ Security & Inter-VLAN
- [ ] ตรวจสอบสิทธิ์การเข้าถึงข้าม VLAN (Ping test)
- [ ] ตั้งค่า ACL บน Router/Gateway (ถ้าจำเป็น)

---
// Change Log:
// - 2026-05-14: Initial VLAN change checklist
