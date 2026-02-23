# 3.5 Shop Drawing Management (การจัดการแบบก่อสร้าง)

---

title: 'Functional Requirements: Shop Drawing Management'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## 3.5.1. วัตถุประสงค์:

- แบบก่อสร้าง (Shop Drawing) ใช้เในการตรวจสอบ โดยจัดส่งด้วย Request for Approval (RFA)

## 3.5.2. ประเภทเอกสาร:

- ไฟล์ PDF, DWG, ZIP

## 3.5.3. การสร้างเอกสาร:

- ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้ โดยผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารรอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น

## 3.5.4. การอ้างอิงและจัดกลุ่ม:

- ใช้สำหรับอ้างอิง ใน RFA, มีการจัดหมวดหมู่ของ Shop Drawings โดยทุก แบบก่อสร้าง (Shop Drawing) แต่ละ revision ต้องมี RFA ได้เพียง 1 ฉบับ
