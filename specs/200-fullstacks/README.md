# 200-fullstacks

โฟลเดอร์นี้ใช้เก็บงานที่เกี่ยวกับ **Fullstack Development** (Backend + Frontend) ของระบบ NAP-DMS

## ขอบเขตงาน (Scope)

งานที่ควรอยู่ในโฟลเดอร์นี้ ได้แก่:

- **Feature Modules** - การพัฒนาฟีเจอร์ใหม่ที่มีทั้ง Backend และ Frontend
- **Module Integration** - การเชื่อมต่อระหว่าง Backend NestJS และ Frontend Next.js
- **Workflow Engine** - การพัฒนา Workflow Engine และการเชื่อมต่อกับ Modules
- **API Development** - การสร้าง API endpoints และ Frontend integration
- **UI Components** - การพัฒนา Components ที่ใช้ร่วมกัน
- **Business Logic** - การพัฒนา Business rules ที่ซับซ้อน

## ตัวอย่างงานที่อยู่ในโฟลเดอร์นี้

- `201-transmittals-circulation` - Transmittals + Circulation Integration
- `203-unified-workflow-engine` - Unified Workflow Engine

## การตั้งชื่อโฟลเดอร์

ใช้รูปแบบ: `2XX-feature-name`

- **2** = หลักร้อยของหมวดหมู่ (200-fullstacks)
- **XX** = เลขลำดับงาน (01, 02, 03, ...)
- **feature-name** = ชื่องาน (kebab-case)

ตัวอย่าง:
- `201-transmittals-circulation`
- `202-rfa-integration`
- `203-unified-workflow-engine`

## โครงสร้างไฟล์ในแต่ละงาน

แต่ละโฟลเดอร์งานควรมีไฟล์ต่อไปนี้ (ถ้าเกี่ยวข้อง):

```
2XX-feature-name/
├── spec.md          # คำอธิบายงานโดยละเอียด
├── plan.md          # แผนการดำเนินงาน
├── tasks.md         # รายการงานย่อย
├── test-report.md   # รายงานการทดสอบ (ถ้ามี)
├── quickstart.md    # คู่มือเริ่มต้น (ถ้ามี)
├── research.md      # การวิจัย/ศึกษา (ถ้ามี)
├── data-model.md    # โครงสร้างข้อมูล (ถ้ามี)
├── checklists/      # Checklist ตรวจสอบ (ถ้ามี)
└── contracts/       # สัญญา/ข้อตกลง (ถ้ามี)
```

## การเชื่อมโยงกับ Core Specs

งานในโฟลเดอร์นี้ควรอ้างอิง Core Specs ที่เกี่ยวข้อง:

- `01-Requirements/` - Business Requirements และ User Stories
- `02-Architecture/` - System Architecture
- `03-Data-and-Storage/` - Schema และ Data Dictionary
- `05-Engineering-Guidelines/` - Backend/Frontend Guidelines
- `06-Decision-Records/` - ADRs ที่เกี่ยวข้อง (ADR-001, ADR-019, ADR-021)
