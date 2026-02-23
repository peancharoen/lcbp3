# 3.2 การจัดการเอกสารโต้ตอบ (Correspondence Management)

---

title: 'Functional Requirements: Correspondence Management'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## 3.2.1. วัตถุประสงค์:

- เอกสารโต้ตอบ (Correspondences) ระหว่างองค์กรณ์-องค์กรณ์ ภายใน โครงการ (Projects) และระหว่าง องค์กรณ์-องค์กรณ์ ภายนอก โครงการ (Projects), รองรับ To (ผู้รับหลัก) และ CC (ผู้รับสำเนา) หลายองค์กรณ์

## 3.2.2. ประเภทเอกสาร:

- ระบบต้องรองรับเอกสารรูปแบบ ไฟล์ PDF, ZIP
- เอกสารโต้ตอบ (Correspondence) สามารถมีได้หลายประเภท (Types) เช่น จดหมาย (Letter), อีเมล์ (Email), Request for Information (RFI), รวมถึง เอกสารขออนุมัติ (RFA) แต่ละ revision และสามารถเพิ่มประเภทใหม่ได้ในภายหลัง

## 3.2.3. การสร้างเอกสาร (Correspondence):

- ผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารรอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น
- เมื่อเอกสารเปลี่ยนสถานะเป็น "Submitted" แล้ว การแก้ไข, ถอนเอกสารกลับไปสถานะ Draft, หรือยกเลิก (Cancel) จะต้องทำโดยผู้ใช้ระดับ Admin ขึ้นไป พร้อมระบุเหตุผล

## 3.2.4. การอ้างอิงและจัดกลุ่ม:

- เอกสารสามารถอ้างถึง (Reference) เอกสารฉบับก่อนหน้าได้หลายฉบับ
- สามารถกำหนด Tag ได้หลาย Tag เพื่อจัดกลุ่มและใช้ในการค้นหาขั้นสูง

## 3.2.5. Workflow (Unified Workflow):

- ระบบต้องรองรับ Workflow ที่เป็นแบบ Unified Workflow
