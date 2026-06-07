# Session 4 — 2026-05-25 (Migration Error Normalization ตาม AGENTS.md)

## ปัญหาที่พบ (Root Cause)

- `Log Error to CSV` และ `Log Error to DB` ใน `n8n.workflow.v2.json` ส่ง `error_type` บางค่าไม่ตรง enum ของ `migration_errors`
- ค่าที่พบจริงและต้อง normalize: `AI_JOB_FAILED`, `PARSE_ERROR`, `TOKEN_EXPIRED`
- backend `AiMigrationCheckpointService.logError()` เดิม insert ค่า `dto.errorType` ตรง ๆ ทำให้เสี่ยง DB enum reject
- ตาราง `migration_errors` เดิมไม่มี `job_id` แม้ workflow/DTO จะมี `jobId` อยู่แล้ว ทำให้ trace กลับไป BullMQ job ไม่ครบ

## การแก้ไข (Fix)

| ไฟล์                                                                                   | การเปลี่ยนแปลย                                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`                                       | normalize `error_type`, `document_number`, `error`, `job_id` ก่อนเขียน CSV/DB |
| `backend/src/modules/ai/ai-migration-checkpoint.service.ts`                            | map/validate `errorType` ซ้ำก่อน insert และเพิ่ม `job_id` ใน SQL insert       |
| `backend/src/modules/migration/entities/migration-error.entity.ts`                     | เพิ่ม field `jobId?: string`                                                  |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-migration.sql`                                 | เพิ่มคอลัมน์ `job_id VARCHAR(100) NULL` และ index                             |
| `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.rollback.sql`       | อัปเดต table definition ของ `migration_errors` ให้มี `job_id`                 |
| `specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.sql`          | เพิ่ม delta สำหรับ add `job_id`                                               |
| `specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.rollback.sql` | เพิ่ม rollback สำหรับ drop `job_id`                                           |
| `backend/src/modules/ai/ai-migration-checkpoint.service.spec.ts`                       | เพิ่ม regression tests สำหรับ error normalization + `job_id`                  |

## Mapping ที่ Lock แล้ว

```
AI_JOB_FAILED -> API_ERROR
PARSE_ERROR -> AI_PARSE_ERROR
TOKEN_EXPIRED -> API_ERROR
unsupported value -> UNKNOWN
```

## กฎใช้งานต่อไป

- ให้ถือ enum ของ `migration_errors.error_type` เป็น source of truth เสมอ
- workflow ต้อง normalize ก่อนส่งเข้า backend และ backend ต้อง normalize ซ้ำอีกชั้น
- ห้ามพึ่ง DB enum reject เป็น validation mechanism
- การเพิ่มคอลัมน์ `job_id` ต้องทำผ่าน SQL/delta ตาม ADR-009 เท่านั้น

## Verification

- workflow normalization assertion — ✅ ผ่าน
- `pnpm --filter backend build` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/ai/ai-migration-checkpoint.service.spec.ts` — ✅ ผ่าน
- regression seam ที่เพิ่มยืนยัน:
  - `AI_JOB_FAILED` map เป็น `API_ERROR`
  - unsupported error type fallback เป็น `UNKNOWN`
