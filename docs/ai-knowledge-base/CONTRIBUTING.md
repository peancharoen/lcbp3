# Contributing to AI Knowledge Base

การเพิ่มข้อมูลเข้าสู่คลังความรู้นี้ช่วยให้ AI ทำงานได้ดีขึ้นสำหรับทุกคนในทีม

## 🛠️ ขั้นตอนการเพิ่ม Prompt ใหม่
1. เลือกหมวดหมู่ที่เหมาะสมใน `prompts/`
2. สร้างไฟล์ใหม่โดยใช้รูปแบบ: `purpose-description.md`
3. ใส่เนื้อหา Prompt โดยแบ่งเป็น:
   - **Role**: บทบาทที่ต้องการให้ AI รับ
   - **Context**: บริบทแวดล้อม
   - **Objective**: วัตถุประสงค์หลัก
   - **Instructions**: ขั้นตอนการทำงาน
   - **Output Format**: รูปแบบผลลัพธ์ที่ต้องการ

## 📐 มาตรฐานการเขียนไฟล์
- **File Header**: ต้องมี `// File: path` ที่บรรทัดแรก
- **Change Log**: ต้องมีประวัติการแก้ไขท้ายไฟล์
- **Language**: หัวข้อหลักเป็น English, รายละเอียดคำอธิบายเป็น Thai

---
// File: docs/ai-knowledge-base/CONTRIBUTING.md
// Change Log:
// - 2026-05-14: Initial guidelines
