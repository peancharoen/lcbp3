# Session — 2026-08-19 (n8n Migration Workflow v4 Fix + UUIDv7 Migration)

## Summary

อัพเกรด n8n จาก 2.21.7 → 2.35.4 และซ่อม LCBP3 Migration Workflow v4.0.0 ให้รันสำเร็จ (Execution #108 = `success`) โดยแก้ปัญหา 11 จุด ตั้งแต่ JWT invalid, HTTP Request node bug, form field mapping, UUIDv1→UUIDv7 migration, code bugs (TDZ, type coercion, disallowed methods), และ path configuration

## ปัญหาที่พบ (Root Cause)

### 1. n8n 2.21.7 ล้าสมัย
- ใช้ n8n 2.21.7 ซึ่งเก่าเกินไป มี bug ใน HTTP Request node และ Form Trigger

### 2. JWT เก่า invalid
- JWT ที่ฝังใน workflow v2 ใช้ไม่ได้เพราะ JWT_SECRET เปลี่ยน ทำให้ `Validate Token` ตอบ 401

### 3. HTTP Request node v4.1 bug
- `Cannot read properties of undefined (reading 'status')` เมื่อใช้ `headerAuth` credential ที่ไม่ถูก resolve ใน n8n 2.35.4

### 4. n8n ใช้ snapshot จาก workflow_history
- การแก้ `workflow_entity.nodes` โดยตรงไม่มีผล — n8n ใช้ snapshot จาก `workflow_history` ต้องอัพเดตทั้งสองตารางพร้อมกัน

### 5. Form fields เป็น null
- n8n Form Trigger v2.2 map fields โดยใช้ `field-${index}` (เช่น `field-0`, `field-1`) ไม่ใช่ field label — การส่ง `Migration Run ID=...` ไม่ match

### 6. Project UUID เป็น UUIDv1 ไม่ใช่ UUIDv7
- seed data ใช้ `uuid()` ของ MariaDB ที่สร้าง UUIDv1 ทำให้ workflow v4 ที่ตรวจ UUIDv7 (ADR-019) ปฏิเสธ project LCBP3

### 7. Code bugs ใน workflow v4
- `contractMatch is not defined` (TDZ error) — ประกาศใน if block แต่ใช้นอก block
- `errorMsg.startsWith is not a function` — errorMsg เป็น object ไม่ใช่ string
- `Can't use .first() in runOnceForEachItem` — n8n ห้ามใช้ `$('...').first()` ใน Run Once for Each Item mode

### 8. Path configuration ผิด
- `SOURCE_PDF_DIR` ชี้ไป `pdfs/` แต่ PDF อยู่ใน `Incoming/`
- `LOG_PATH` ชี้ไป read-only mount (`/mnt/asustor-legacy`)

## การแก้ไข (Fix)

| ไฟล์/Component | การเปลี่ยนแปลง |
|---|---|
| `/opt/np-dms/02-platform/docker-compose.yml` | n8n image `n8nio/n8n:2.21.7` → `n8nio/n8n:2.35.4` |
| n8n DB: `workflow_entity` + `workflow_history` | อัพเดต v4 workflow nodes (Validate Token → Code node, แก้ bugs 5 จุด, แก้ paths 2 จุด) |
| n8n DB: `credentials_entity` | เพิ่ม `Migration Token (Backend)` (httpHeaderAuth, ID: MigTokBackend001) |
| MariaDB: `users`, `organizations`, `projects`, `contracts`, `roles` | UUIDv1 → UUIDv7 migration (44 rows) |
| MariaDB: `distribution_recipients`, `document_chunks`, `workflow_histories` | อัพเดต logical FK columns ที่อ้างถึง UUID |

## กฎที่ Lock แล้ว

- **D113**: n8n ใช้ snapshot จาก `workflow_history` ไม่ใช่ `workflow_entity` — ต้องอัพเดตทั้งสองตารางพร้อมกันเมื่อแก้ workflow โดยตรง
- **D114**: n8n Form Trigger v2.2 map fields ด้วย `field-${index}` ไม่ใช่ field label — curl test ต้องใช้ `-F "field-0=..."` format
- **D115**: HTTP Request node v4.1 ใน n8n 2.35.4 มี bug กับ `headerAuth` credential — ใช้ Code node + `helpers.httpRequest` แทนสำหรับ authenticated requests
- **D116**: seed data ใช้ `uuid()` ของ MariaDB = UUIDv1 — ต้องแปลงเป็น UUIDv7 ตาม ADR-019 ด้วย Python script (MariaDB ไม่มี UUIDv7 function)

## Verification

- [x] n8n 2.35.4 healthy (`docker ps` แสดง `Up X minutes (healthy)`)
- [x] v4 workflow activated (`docker logs n8n` แสดง `Activated workflow "LCBP3 Migration Workflow v4.0.0"`)
- [x] Form submission สำเร็จ (HTTP 200 จาก POST `/form/{webhookId}`)
- [x] Execution #108 = `success` (10:45:25 - 10:45:37, ~12 วินาที)
- [x] ผ่านครบทุก node: Form Trigger → Validate Form Input → Check Backend Health → Validate Token → Verify Migration Scope → Resolve Project → Resolve Contract → Set Resolved UUIDs → Fetch Categories → Fetch Tags → File Mount Check → Read Excel → Read Checkpoint → File Validator → (loop: Process Batch, Log Error, Save Checkpoint, Prepare Terminal Checkpoint)
- [x] UUIDv1 = 0 ทุกตาราง (users, organizations, projects, contracts, roles)
- [x] Project LCBP3 UUID = `01a01992-8420-7312-b8da-2a4d64133fea` (UUIDv7)
- [ ] **ทดสอบจาก browser จริง** ที่ `https://n8n.np-dms.work/webhook-form/2527e114-c0fe-4f46-8d8c-4974c22c4574`
- [ ] **Rotate JWT/password** หลัง workflow stable

## คำเตือนด้านความปลอดภัย

- **JWT ที่ฝังใน workflow** เป็น token ที่ใช้ตอน debugging — ควร rotate หลัง stabilize
- **Password ที่ใช้ login** ควร rotate เช่นกัน

## ข้อควรทำต่อ

1. ทดสอบจาก browser จริงผ่าน public URL
2. Rotate JWT/password หลัง workflow stable
3. แปลง `WEBHOOK_URL` → `N8N_WEBHOOK_URL` (deprecated)
4. วางแผน PostgreSQL 16 → 17 upgrade
5. วางแผน binary storage migration ก่อน n8n 3.0
