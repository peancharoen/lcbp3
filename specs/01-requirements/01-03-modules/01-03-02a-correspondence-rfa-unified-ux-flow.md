# 3.2A Correspondence-RFA Unified List & UX Flow

---

title: 'Implementation Note: Unified Correspondence List (RFA Filter) and UX Flow'
version: 1.0.0
status: implemented
owner: Nattanin Peancharoen
last_updated: 2026-03-31
related:

- specs/01-requirements/01-03-modules/01-03-02-correspondence.md
- specs/01-requirements/01-03-modules/01-03-03-rfa.md
- specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
- specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md

---

## 1) วัตถุประสงค์

อธิบาย implementation ที่รวมหน้า list ของ RFA เข้ากับหน้า Correspondence โดยใช้ filter `type=RFA` โดยยังคงหน้า RFA เฉพาะทาง (`new/detail/edit`) เพื่อรองรับ extension logic ของ `rfas`, `rfa_revisions`, `rfa_items`.

## 2) Routing Strategy

### 2.1 Canonical List

- Canonical list route: `/correspondences`
- RFA list filter route: `/correspondences?type=RFA`

### 2.2 Redirect Policy

- `/rfas` -> `/correspondences?type=RFA`
- `/rfa` -> `/correspondences?type=RFA`

### 2.3 Preserved RFA Pages

- `/rfas/new`
- `/rfas/[uuid]`
- `/rfas/[uuid]/edit`

## 3) Query & Filtering Behavior

- Frontend รับ `type` จาก query string (เช่น `RFA`) แล้ว map เป็น `typeId` ผ่าน master correspondence types
- API call ใช้ `/correspondences` พร้อม `typeId` เพื่อให้ backend filter ตาม `correspondence_type_id`
- เมื่อ filter เป็น RFA ระบบยังคงใช้ correspondence list payload (revision-based list)

## 4) UX Flow Diagram in UI

หน้า `/correspondences` มีปุ่ม `UX Flow` เพื่อแสดง flow หลัก:

1. สร้าง Master (`correspondences`)
2. สร้าง Current Revision (`correspondence_revisions`)
3. Two-phase attachment upload/commit (`attachments` + `correspondence_revision_attachments`)
4. Submit เข้า workflow
5. วน revision cycle (current revision เปลี่ยนได้ทีละหนึ่ง)
6. RFA extension path (list รวม แต่ form/detail ยังแยก)

## 5) Theme Direction (Dashboard)

- ใช้โทน `dark-blue` เป็น default
- รองรับ toggle ระหว่าง `dark` และ `light (white)`
- ใช้ token-based theming (`globals.css` + Tailwind mapped variables)

## 6) Data Model Alignment (Source of Truth)

เพื่อให้ตรงกับ schema และโค้ดที่ใช้งานจริง:

- Attachment model ของ correspondence/rfa non-drawing ใช้ revision-level relation ผ่าน `correspondence_revision_attachments`
- หลีกเลี่ยงการอ้าง `correspondence_attachments` เป็น table หลักของ revision ใน implementation ปัจจุบัน

## 7) Acceptance Checklist

- [x] `/rfas` และ `/rfa` redirect ถูกต้อง
- [x] `/correspondences?type=RFA` แสดง list RFA ได้
- [x] `/rfas/new`, `/rfas/[uuid]`, `/rfas/[uuid]/edit` ยังใช้งานได้
- [x] มีปุ่ม `UX Flow` ในหน้า UI จริง
- [x] Theme default เป็น dark-blue พร้อม toggle white/dark
- [x] สเปกหลักสองไฟล์อัปเดตสอดคล้อง implementation
