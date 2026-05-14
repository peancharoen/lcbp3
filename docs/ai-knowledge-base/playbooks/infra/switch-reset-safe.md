// File: docs/ai-knowledge-base/playbooks/infra/switch-reset-safe.md
# Playbook: Safe Switch Reset & Re-adoption

## 🎯 Objective
การทำ Factory Reset และทำการ Adopt ใหม่ใน Omada Controller โดยไม่ให้ระบบล่มเป็นเวลานาน

## 🏗️ Steps
1. **Backup Config**: ตรวจสอบว่ามี Backup ของ Omada Controller ล่าสุดหรือไม่
2. **Physical Reset**: กดปุ่ม Reset ที่ตัว Switch ค้างไว้จนไฟกะพริบ
3. **Omada Discovery**: รอจน Switch ปรากฏขึ้นมาในสถานะ "Pending"
4. **Adopt & Provision**: คลิก Adopt และรอให้ Controller ทำการส่ง Config (Provisioning) ไปยัง Switch
5. **VLAN Check**: ตรวจสอบว่า Port ต่างๆ ยังทำงานตาม VLAN Profile เดิมหรือไม่

---
// Change Log:
// - 2026-05-14: Initial safe reset playbook
