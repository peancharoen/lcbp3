// File: docs/ai-knowledge-base/playbooks/infra/omada-vlan-recovery.md
# Playbook: Omada VLAN Recovery

## 🚨 Scenario
VLAN ใช้งานไม่ได้ หรือ Client ไม่สามารถรับ IP ได้หลังจากมีการเปลี่ยน Config

## 🛠️ Recovery Steps
1. **Check Controller Connection**: ตรวจสอบว่า Omada Controller ยังออนไลน์อยู่หรือไม่
2. **Revert Last Change**: หากจำได้ ให้ Revert การตั้งค่าล่าสุดทันที
3. **Switch Log Audit**: เข้าไปดู Log ของ Switch ในหน้า Omada เพื่อหา Error (e.g. Loop Detected)
4. **Port Profile Verification**: ตรวจสอบว่า Port ที่ Client ต่ออยู่ ใช้ Profile VLAN ที่ถูกต้อง
5. **Re-adopt Device**: หาก Switch สถานะเป็น "Disconnected" ให้ลองทำการ Re-adopt หรือ Restart Switch

---
// Change Log:
// - 2026-05-14: Initial Omada recovery playbook
