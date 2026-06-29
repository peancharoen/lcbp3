# 300-others

โฟลเดอร์นี้ใช้เก็บงานที่ไม่ใช่ Infrastructure หรือ Fullstack Development เช่น เอกสาร การวิจัย หรืองานที่ไม่ใช่การพัฒนาโค้ด

## ขอบเขตงาน (Scope)

งานที่ควรอยู่ในโฟลเดอร์นี้ ได้แก่:

- **Documentation** - เอกสารประกอบการทำงานที่ไม่ใช่ Core Specs
- **Research** - การวิจัยเทคโนโลยี การศึกษาเคส
- **Non-code Tasks** - งานที่ไม่ใช่การพัฒนาโค้ด เช่น การตั้งค่า Tools, การจัดทำ Manual
- **Process Improvement** - การปรับปรุง Process การทำงาน
- **Training Materials** - วัสดุการอบรมที่ไม่ใช่ Core Training Plan

## ตัวอย่างงานที่อาจอยู่ในโฟลเดอร์นี้

- `301-documentation-templates` - Templates สำหรับเอกสาร
- `302-research-ai-tools` - การวิจัยเครื่องมือ AI
- `303-process-automation` - การทำ Automation ที่ไม่ใช่โค้ด

## การตั้งชื่อโฟลเดอร์

ใช้รูปแบบ: `3XX-task-name`

- **3** = หลักร้อยของหมวดหมู่ (300-others)
- **XX** = เลขลำดับงาน (01, 02, 03, ...)
- **task-name** = ชื่องาน (kebab-case)

ตัวอย่าง:
- `301-documentation-templates`
- `302-research-ai-tools`
- `303-process-automation`

## โครงสร้างไฟล์ในแต่ละงาน

แต่ละโฟลเดอร์งานอาจมีไฟล์ต่อไปนี้ (ขึ้นอยู่กับประเภทงาน):

```
3XX-task-name/
├── spec.md          # คำอธิบายงาน (ถ้ามี)
├── plan.md          # แผนการดำเนินงาน (ถ้ามี)
├── tasks.md         # รายการงานย่อย (ถ้ามี)
├── research.md      # ผลการวิจัย (ถ้าเป็นงานวิจัย)
├── documentation/   # เอกสารต่างๆ (ถ้าเป็นงานเอกสาร)
└── templates/       # Templates (ถ้ามี)
```

## การเชื่อมโยงกับ Core Specs

งานในโฟลเดอร์นี้อาจอ้างอิง Core Specs ที่เกี่ยวข้อง:

- `00-overview/` - Product Vision และ Training Plan
- `05-Engineering-Guidelines/` - Process Guidelines
- `06-Decision-Records/` - ADRs ที่เกี่ยวข้อง (ถ้ามี)
