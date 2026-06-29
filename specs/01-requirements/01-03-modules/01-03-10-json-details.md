# 3.10 JSON Details Management (การจัดการ JSON Details)

---

title: 'Functional Requirements: JSON Details Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-02-correspondence.md
- specs/01-requirements/01-03-modules/01-03-03-rfa.md
- specs/01-requirements/01-03-modules/01-03-06-unified-workflow.md
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/06-Decision-Records/ADR-009-db-strategy.md

---

## 3.10.1. วัตถุประสงค์

ระบบใช้ `JSON` column สำหรับข้อมูลที่มีโครงสร้างแตกต่างกันตามประเภทเอกสาร โดยไม่ต้องเพิ่ม column ใหม่ใน Schema รองรับการขยายตัวโดยไม่กระทบ ADR-009 (No-migration policy)

---

## 3.10.2. JSON Columns ในระบบ (ครบทุกตาราง)

| ตาราง | Column | วัตถุประสงค์ |
|---|---|---|
| `correspondence_revisions` | `details` | ข้อมูลเฉพาะตามประเภทเอกสาร (Letter, RFI ฯลฯ) |
| `rfa_revisions` | `details` | ข้อมูลเฉพาะ RFA (เช่น drawingCount) |
| `workflow_definitions` | `dsl` | นิยาม Workflow ต้นฉบับ (JSON DSL) |
| `workflow_definitions` | `compiled` | Execution Tree ที่ Compile แล้ว |
| `workflow_instances` | `context` | ตัวแปร Context สำหรับตัดสินใจ Transition |
| `workflow_histories` | `metadata` | Snapshot ข้อมูล ณ ขณะ Transition |
| `audit_logs` | `details_json` | ข้อมูล Context เพิ่มเติมของ Event |
| `document_numbers` | `counter_key` | Counter key (8 fields) สำหรับ Document Numbering |
| `document_numbers` | `metadata` | Additional context ของการออกเลข |
| `document_number_errors` | `context_data` | Context ของ request ที่เกิด error |
| `json_schemas` | `schema_definition` | JSON Schema (AJV Standard) |
| `json_schemas` | `ui_schema` | UI Schema สำหรับ Frontend render |
| `json_schemas` | `virtual_columns` | Config สำหรับสร้าง Virtual Columns |
| `json_schemas` | `migration_script` | Script แปลงข้อมูลระหว่าง versions |

---

## 3.10.3. JSON Schema Registry (json_schemas)

ระบบมีตาราง `json_schemas` เป็น **Centralized Registry** สำหรับ validate และ manage โครงสร้าง JSON:

| Field | หมายเหตุ |
|---|---|
| `schema_code` | รหัส Schema เช่น `RFA_DWG`, `CORRESPONDENCE_LETTER` |
| `version` | Version ของ Schema (UNIQUE ร่วมกับ `schema_code`) |
| `table_name` | ตารางเป้าหมาย เช่น `rfa_revisions` |
| `schema_definition` | โครงสร้าง AJV JSON Schema สำหรับ validation |
| `ui_schema` | โครงสร้าง UI Schema สำหรับ Frontend render dynamic form |
| `virtual_columns` | Config สำหรับสร้าง Generated Columns |
| `migration_script` | Script แปลงข้อมูลจาก version ก่อนหน้า |

---

## 3.10.4. Virtual Columns (Generated Columns)

JSON field ที่ต้องใช้ใน Query / Search สร้างเป็น **Generated Virtual Column** + Index:

| ตาราง | Virtual Column | JSON Path | ใช้สำหรับ |
|---|---|---|---|
| `correspondence_revisions` | `v_ref_project_id` | `$.projectId` | Filter by Project |
| `correspondence_revisions` | `v_doc_subtype` | `$.subType` | Filter by Sub-type |
| `rfa_revisions` | `v_ref_drawing_count` | `$.drawingCount` | Count / Sort |

**กฎสำคัญ:** Field ที่เป็น Virtual Column **ห้ามเปลี่ยน JSON key หรือ data type** ใน version ถัดไป — ต้องมีแผน Re-index / Migration ก่อน

---

## 3.10.5. Validation Rules

- Backend validate ด้วย `json_schemas.schema_definition` (AJV Standard) ก่อน save ทุกครั้ง
- แต่ละ record มี `schema_version` — ใช้เลือก schema ที่ถูกต้องสำหรับ validate
- Field ไม่บังคับ → ใช้ `default` value ตามที่กำหนดใน schema
- Sanitize JSON input เพื่อป้องกัน injection ก่อน validate

---

## 3.10.6. JSON Schema Migration Strategy

### Breaking Changes (เปลี่ยน key / type)

1. **Phase 1 — Add New Virtual Column** ด้วย path ใหม่
2. **Phase 2 — Backfill Old Records** ด้วย background job (batch 1,000 records)
3. **Phase 3 — Deploy Application Code** ที่ใช้ path ใหม่
4. **Phase 4 — Drop Old Column** หลัง verify ไม่มี error

### Non-Breaking Changes (เพิ่ม optional field)

- เพิ่ม field ใน schema definition — old records ที่ไม่มี field ใช้ `default` value อัตโนมัติ
- ไม่ต้อง backfill

---

> **หมายเหตุ:** เนื้อหาเดิม §3.13 (Impersonation) และ §3.14 (Master Data Management) ได้ถูกย้ายไปยัง spec ที่เกี่ยวข้องแล้ว:
> - Impersonation → `01-02-01-rbac-matrix.md`
> - Disciplines Management → `01-03-01-project-management.md` (§3.1.6)
> - Numbering Format → Document Numbering spec
