# 3.12 JSON Details Management (การจัดการ JSON Details)

---

title: 'Functional Requirements: JSON Details Management'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## 3.12.1 วัตถุประสงค์

- จัดเก็บข้อมูลแบบไดนามิกที่เฉพาะเจาะจงกับแต่ละประเภทของเอกสาร
- รองรับการขยายตัวของระบบโดยไม่ต้องเปลี่ยนแปลง database schema
- จัดการ metadata และข้อมูลประกอบสำหรับ correspondence, routing, และ workflows

## 3.12.2 โครงสร้าง JSON Schema

- ระบบต้องมี predefined JSON schemas สำหรับประเภทเอกสารต่างๆ:

  - 3.12.2.1 Correspondence Types
    - GENERIC: ข้อมูลพื้นฐานสำหรับเอกสารทั่วไป
    - RFI: รายละเอียดคำถามและข้อมูลทางเทคนิค
    - RFA: ข้อมูลการขออนุมัติแบบและวัสดุ
    - TRANSMITTAL: รายการเอกสารที่ส่งต่อ
    - LETTER: ข้อมูลจดหมายทางการ
    - EMAIL: ข้อมูลอีเมล
  - 3.12.2.2 Rworkflow Types
    - workflow_definitions: กฎและเงื่อนไขการส่งต่อ
    - workflow_histories: สถานะและประวัติการส่งต่อ
    - workflow_instances: การดำเนินการในแต่ละขั้นตอน
  - 3.12.2.3 Audit Types
    - AUDIT_LOG: ข้อมูลการตรวจสอบ
    - SECURITY_SCAN: ผลการตรวจสอบความปลอดภัย

## 3.12.3 Virtual Columns (ปรับปรุง)

- สำหรับ Field ใน JSON ที่ต้องใช้ในการค้นหา (Search) หรือจัดเรียง (Sort) บ่อยๆ ต้องสร้าง Generated Column (Virtual Column) ใน Database และทำ Index ไว้ เพื่อประสิทธิภาพสูงสุด
- Schema Consistency: Field ที่ถูกกำหนดเป็น Virtual Column ห้าม เปลี่ยนแปลง Key Name หรือ Data Type ใน JSON Schema Version ถัดไป หากจำเป็นต้องเปลี่ยน ต้องมีแผนการ Re-index หรือ Migration ข้อมูลเดิมที่ชัดเจน

## 3.12.4 Validation Rules

- ต้องมี JSON schema validation สำหรับแต่ละประเภท
- ต้องรองรับ versioning ของ schema
- ต้องมี default values สำหรับ field ที่ไม่บังคับ
- ต้องตรวจสอบ data types และ format ให้ถูกต้อง

## 3.12.5 Performance Requirements

- JSON field ต้องมีขนาดไม่เกิน 50KB
- ต้องรองรับ indexing สำหรับ field ที่ใช้ค้นหาบ่อย
- ต้องมี compression สำหรับ JSON ขนาดใหญ่

## 3.12.6 Security Requirements

- ต้อง sanitize JSON input เพื่อป้องกัน injection attacks
- ต้อง validate JSON structure ก่อนบันทึก
- ต้อง encrypt sensitive data ใน JSON fields

## 3.12.7 JSON Schema Migration Strategy (เพิ่มเติม)

- สำหรับ Schema Breaking Changes:

  - Phase 1 - Add New Column
    ALTER TABLE correspondence_revisions
    ADD COLUMN ref_project_id_v2 INT GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(details, '$.newProjectIdPath'))) VIRTUAL;

  - Phase 2 - Backfill Old Records
    - ใช้ background job แปลง JSON format เก่าเป็นใหม่
    - Update `details` JSON ทีละ batch (1000 records)
  - Phase 3 - Switch Application Code
    - Deploy code ที่ใช้ path ใหม่
  - Phase 4 - Remove Old Column

    - หลังจาก verify แล้วว่าไม่มี error
    - Drop old virtual column

  - สำหรับ Non-Breaking Changes
    - เพิ่ม optional field ใน schema
    - Old records ที่ไม่มี field = ใช้ default value

## 3.13. ข้อกำหนดพิเศษ

- ผู้ใช้งานที่มีสิทธิ์ระดับสูง (Global) หรือผู้ได้รับอนุญาตเป็นกรณีพิเศษ
  - สามารถเลือก สร้างในนามองค์กร (Create on behalf of) ได้ เพื่อให้สามารถออกเลขที่เอกสาร (Running Number) ขององค์กรอื่นได้โดยไม่ต้องล็อกอินใหม่
  - สามารถทำงานแทนผู้ใช้งานอื่นได้ Routing & Workflow ของ Correspondence, RFA, Circulation Sheet

## 3.14. การจัดการข้อมูลหลักขั้นสูง (Master Data Management)

- 3.14.1. Disciplines Management: Admin ต้องสามารถ เพิ่ม/ลบ/แก้ไข สาขางาน (Disciplines) แยกตามสัญญา (Contract) ได้
- 3.14.2. Sub-Type Mapping: Admin ต้องสามารถกำหนด Correspondence Sub-types และ Mapping รหัสตัวเลข (เช่น MAT = 11) ได้
- 3.14.3. Numbering Format Configuration: ระบบต้องรองรับการตั้งค่า Format Template ของแต่ละ Project/Type ได้โดยไม่ต้องแก้โค้ด
