# Research: Context-Aware Prompts & DB CC Cleanup

**Feature**: Context-Aware Prompt Templates & Database Typo Cleanup
**Created**: 2026-05-27

---

## 1. Context Resolution Strategy (Master Data Injection)

### Decision
ใช้การรวบรวม (Aggregation) Master Data ใน Backend Service ก่อนป้อนให้ AI เป็นข้อความ JSON string สองมิติ (List Format) แทนที่จะให้ AI เชื่อมต่อฐานข้อมูลโดยตรง

### Rationale
สอดคล้องกับข้อกำหนดความปลอดภัย **ADR-023** อย่างเคร่งครัด AI ห้ามติดต่อฐานข้อมูลเองเด็ดขาด และการที่ Backend ดึงข้อมูลให้อ่านง่ายจะช่วยประหยัด Context Size ได้เป็นอย่างดี

### Alternatives Considered
- **ดึงแบบ Dynamic Tooling (ADR-025):** ให้ AI รัน Tool ค้นหาเองทีละฟิลด์
  - *ข้อเสีย:* ช้าและมีค่าใช้จ่าย (Latency) สูงมากสำหรับการสกัดข้อมูลเริ่มต้น และตัวแบบระดับ 8B พารามิเตอร์อาจจำฟิล์เตอร์สับสนได้

---

## 2. Database Cleanup of whitespace CC Typo

### Decision
เขียน SQL Delta ปรับปรุง ENUM คอลัมน์ `recipient_type` ในตาราง `correspondence_recipients` จาก `'CC '` เป็น `'CC'` และรัน Script Normalization ย้อนหลัง

### Rationale
เนื่องจากค่าช่องว่างเป็น Typo ตั้งแต่การออกแบบโครงสร้างหลัก การตัดและล้างข้อมูลแบบถาวรจะช่วยลดหนี้ทางเทคนิค (Technical Debt) และหมดปัญหา Backend/Frontend ต้องคอยดักจับ trim() ข้อมูลย้อนหลังไปตลอดชีวิตระบบ

### Alternatives Considered
- **ทำ Normalization ที่ Backend (Safe Fallback):**
  - *ข้อเสีย:* เป็นการเลี่ยงปัญหาและทิ้งความซับซ้อนใน source code โดยไม่จำเป็น
