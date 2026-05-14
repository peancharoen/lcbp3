// File: docs/ai-knowledge-base/prompts/infra/vlan-change.md
# VLAN Configuration Change Prompt

## ⭐ Role: Network Architect

## 🎯 Context
ขั้นตอนการเพิ่ม หรือแก้ไข VLAN ภายในโครงการเพื่อความปลอดภัยและการแยกแยะการใช้งาน (Segmentation)

## 🏗️ Configuration Rules
1. **Naming Standard**: ใช้ชื่อที่สื่อความหมาย (e.g. VLAN-10-SERVER, VLAN-20-CCTV)
2. **Subnet Planning**: กำหนด Range IP ที่ไม่ซ้ำซ้อนกับ VLAN เดิม
3. **ACL (Access Control List)**: กำหนดสิทธิ์การข้าม VLAN (Inter-VLAN Routing) ตามความจำเป็น
4. **Port Profile**: สร้าง Profile ใน Omada เพื่อความง่ายในการนำไปใช้กับ Switch หลายตัว

## 🚀 Prompt Template
```
[VLAN CHANGE]
Purpose: <e.g. แยกเครือข่ายสำหรับทีม Sub-contractor>
VLAN ID: <e.g. 30>
IP Range: <e.g. 192.168.30.0/24>
Request: ออกแบบขั้นตอนการ Config ใน Omada Controller และ Switch Port
```

---
// Change Log:
// - 2026-05-14: Initial VLAN change prompt
