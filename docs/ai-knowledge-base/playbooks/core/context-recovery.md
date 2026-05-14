// File: docs/ai-knowledge-base/playbooks/core/context-recovery.md
# Playbook: AI Context Recovery (ฟื้นฟูบริบทการทำงาน)

## 🚨 เมื่อไหร่ที่ต้องใช้?
- เมื่อเริ่ม Session ใหม่กับ AI
- เมื่อ AI เริ่มให้คำตอบที่หลุดออกจากมาตรฐานโครงการ
- เมื่อมีการข้ามเฟสการทำงานขนาดใหญ่

## 🏗️ Steps for Recovery
1. **Initialize Standards**: สั่งให้ AI อ่าน `docs/ai-knowledge-base/prompts/core/master-prompt.md`
2. **Scan Current Module**: ระบุโมดูลที่กำลังทำงาน และให้ AI อ่านไฟล์ใน `specs/` ที่เกี่ยวข้อง
3. **Verify DB State**: ให้ AI อ่านไฟล์ Schema ล่าสุดเพื่อยืนยันโครงสร้างตาราง
4. **Task Alignment**: ตรวจสอบไฟล์ `tasks.md` ของฟีเจอร์นั้นๆ เพื่อหาจุดที่ทำค้างไว้
5. **Conflict Resolution**: หาก AI พบว่าโค้ดปัจจุบันขัดกับ Specs ให้ทำการแก้ไขทันที

## 🚀 Recovery Command (Prompt)
"โปรดอ่าน Master Prompt และตรวจสอบสถานะปัจจุบันของโมดูล [ชื่อโมดูล] จากไฟล์ Specs และ Tasks เพื่อเตรียมตัวเริ่มงานต่อจากจุดที่ค้างไว้"

---
// Change Log:
// - 2026-05-14: Initial context recovery playbook
