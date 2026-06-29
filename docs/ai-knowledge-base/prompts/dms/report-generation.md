// File: docs/ai-knowledge-base/prompts/dms/report-generation.md
# Report Generation Prompt (DMS)

## ⭐ Role: Data Analyst / Backend Developer

## 🎯 Context
การสร้างรายงาน (Reports) จากข้อมูลในระบบ DMS เช่น สรุปสถานะ RFA ประจำสัปดาห์ หรือรายงานความคืบหน้าของ Drawing

## 📊 Reporting Requirements
1. **Data Source**: ดึงข้อมูลจากตารางหลัก (Correspondence, RFA, etc.) และตาราง History
2. **Filters**: ต้องรองรับการกรองตาม Project, Discipline, Date Range และ Status
3. **Export Formats**: รองรับ PDF (สำหรับเซ็นชื่อ) และ Excel (สำหรับวิเคราะห์ข้อมูล)
4. **Performance**: ใช้ Aggregate Queries ที่มีประสิทธิภาพ และทำ Caching หากจำเป็น

## 🚀 Prompt Template
```
[REPORT DESIGN]
Report Name: <ชื่อรายงาน>
Columns: <รายการฟิลด์ที่ต้องการแสดง>
Group By: <e.g. Discipline, Sub-contractor>
Export Format: <Excel/PDF>
Request: ออกแบบ Query และโครงสร้างข้อมูลสำหรับสร้างรายงานนี้
```

---
// Change Log:
// - 2026-05-14: Initial report generation prompt
