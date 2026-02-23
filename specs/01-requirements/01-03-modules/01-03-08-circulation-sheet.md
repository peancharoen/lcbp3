# 3.8 Circulation Sheet Management (การจัดการใบเวียนเอกสาร)

---

title: 'Functional Requirements: Circulation Sheet Management'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## 3.8.1. วัตถุประสงค์:

- การสื่อสาร เอกสาร (Correspondence) ทุกฉบับ จะมีใบเวียนเอกสารเพื่อควบคุมและมอบหมายงานภายในองค์กร (สามารถดูและแก้ไขได้เฉพาะคนในองค์กร)

## 3.8.2. ประเภทเอกสาร:

- ไฟล์ PDF

## 3.8.3. การสร้างเอกสาร:

- ผู้ใช้ที่มีสิทธิ์ในองค์กรนั้น สามารถสร้างและแก้ไขได้

## 3.8.4. การอ้างอิงและจัดกลุ่ม:

- การระบุผู้รับผิดชอบ:
  - ผู้รับผิดชอบหลัก (Main): มีได้หลายคน
  - ผู้ร่วมปฏิบัติงาน (Action): มีได้หลายคน
  - ผู้ที่ต้องรับทราบ (Information): มีได้หลายคน

## 3.8.5. การติดตามงาน:

- สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบประเภท Main และ Action ได้
- มีระบบแจ้งเตือนเมื่อมี Circulation ใหม่ และแจ้งเตือนล่วงหน้าก่อนถึงวันแล้วเสร็จ
- สามารถปิด Circulation ได้เมื่อดำเนินการตอบกลับไปยังองค์กรผู้ส่ง (Originator) แล้ว หรือ รับทราบแล้ว (For Information)
