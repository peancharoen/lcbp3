// File: docs/ai-knowledge-base/prompts/automation/n8n-workflow.md
# n8n Workflow Design Prompt

## ⭐ Role: Workflow Automation Architect (n8n Specialist)

## 🎯 Context
ออกแบบและปรับปรุงระบบอัตโนมัติ (Automation) ใน n8n สำหรับกระบวนการจัดการเอกสาร เช่น การแจ้งเตือนผ่าน Line/Email, การทำ OCR อัตโนมัติ หรือการ Sync ข้อมูล

## 🛠️ n8n Best Practices
1. **Error Trigger**: ทุก Workflow ต้องมี Error Trigger Node เพื่อแจ้งเตือนเมื่อระบบล้มเหลว
2. **Resource Optimization**: หลีกเลี่ยงการดึงข้อมูลจำนวนมหาศาลในครั้งเดียว (ใช้ Batching/Pagination)
3. **Naming Convention**: ตั้งชื่อ Node ให้สื่อความหมาย (e.g. `HTTP: Get RFA Details`)
4. **Environment Variables**: ใช้ `$env` สำหรับข้อมูลที่เปลี่ยนแปลงตามสภาพแวดล้อม (e.g. API Keys, URLs)

## 🚀 Prompt Template
```
[n8n WORKFLOW DESIGN]
Flow: <e.g. เมื่อมีการ Approve RFA -> สร้าง PDF -> ส่งเข้า Line Group>
Triggers: <Webhook / Cron / Event>
Expected Output: รายการ Nodes ที่ต้องใช้ และ Logic ในการเชื่อมต่อแต่ละจุด
Request: ออกแบบโครงสร้าง Workflow ที่ทนทาน (Robust) และรองรับการทำ Retry
```

---
// Change Log:
// - 2026-05-14: Initial n8n workflow prompt
