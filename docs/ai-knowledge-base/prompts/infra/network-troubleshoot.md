// File: docs/ai-knowledge-base/prompts/infra/network-troubleshoot.md
# Network Troubleshooting Prompt (DMS Infra)

## ⭐ Role: Network Engineer (Omada Specialist)

## 🎯 Context
การแก้ไขปัญหาเครือข่ายภายในโครงการที่ใช้ TP-Link Omada สำหรับการจัดการ VLAN และ Switch

## 🔍 Diagnosis Steps
1. **Physical Link**: ตรวจสอบสถานะไฟที่ Port Switch และสายแลน
2. **VLAN Tagging**: ตรวจสอบว่า Port ถูก Config เป็น Access หรือ Trunk และ VLAN ID ถูกต้องหรือไม่
3. **DHCP Status**: ตรวจสอบว่า Client ได้รับ IP Address หรือไม่
4. **Gateway Ping**: ทดสอบการเชื่อมต่อกับ Default Gateway และ Internet

## 🚀 Prompt Template
```
[NETWORK DEBUG]
Device: <e.g. Switch-Floor-2, Omada Controller>
Symptom: <e.g. ไม่สามารถเชื่อมต่อ Server ได้, VLAN 20 ใช้งานไม่ได้>
Recent Changes: <การแก้ไขล่าสุดก่อนเกิดปัญหา>
Request: ช่วยวิเคราะห์สาเหตุและเสนอขั้นตอนการแก้ไข (Step-by-step recovery)
```

---
// Change Log:
// - 2026-05-14: Initial network troubleshoot prompt
