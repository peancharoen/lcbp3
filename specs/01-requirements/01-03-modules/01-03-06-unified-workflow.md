# 3.6 Unified Workflow Management (การจัดการ Workflow)

---

title: 'Functional Requirements: Unified Workflow Management'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## 3.6.1 Workflow Definition:

- Admin ต้องสามารถกำหนดและสร้าง/แก้ไข Workflow Rule ได้ (DSL)
- รองรับการกำหนด State, Transition, Required Role, Condition (JS Expression)

## 3.6.2 Workflow Execution:

- ระบบต้องรองรับการสร้าง Instance ของ Workflow ผูกกับเอกสาร (Polymorphic)
- รองรับการเปลี่ยนสถานะ (Action) เช่น Approve, Reject, Comment, Return
- Auto-Action: รองรับการเปลี่ยนสถานะอัตโนมัติเมื่อครบเงื่อนไข (เช่น Review ครบทุกคน)

## 3.6.3 Flexibility:

- รองรับ Parallel Review (ส่งให้หลายคนตรวจพร้อมกัน)
- รองรับ Conditional Flow (เช่น ถ้ายอดเงิน > X ให้เพิ่มผู้อนุมัติ)

## 3.6.4 Workflow การอนุมัติ:

- รองรับกระบวนการอนุมัติที่ซับซ้อนและเป็นลำดับ เช่น ส่งจาก Originator -> Organization 1 -> Organization 2 -> Organization 3 แล้วส่งผลกลับตามลำดับเดิม (โดยถ้า องกรณ์ใดใน Workflow ให้ส่งกลับ ก็สามารถส่งผลกลับตามลำดับเดิมโดยไม่ต้องรอให้ถึง องกรณืในลำดับถัดไป)

## 3.6.5 การจัดการ:

- สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ได้
- มีระบบแจ้งเตือน ให้ผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ทราบ เมื่อมี RFA ใหม่ หรือมีการเปลี่ยนสถานะ
- สามารถข้ามขั้นตอนได้ในกรณีพิเศษ (โดยผู้มีสิทธิ์)
- สามารถส่งกลับขั้นตอนก่อนหน้าได้
