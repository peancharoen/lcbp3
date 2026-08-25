# Session D161 — 2026-08-25 (ลบ dead code migration_logs ADR-020 era)

## Summary

ลบ obsolete `migration_logs` pipeline ทั้งหมด (backend + frontend + schema) หลัง ADR-023/023A เปลี่ยนไปใช้ BullMQ + `migration_review_queue` — 17 files changed, +2104/-3430 บรรทัด, commit `6745867f` pushed to `origin/main`.

## ปัญหาที่พบ (Root Cause)

หลัง ADR-023/023A ปรับสถาปัตยกรรม AI migration ไปใช้ BullMQ + `migration_review_queue` แทน direct n8n webhook + `migration_logs` table, code เดิม (endpoints, service methods, DTOs, entity, frontend component, env vars) กลายเป็น dead code แต่ยังไม่ถูกลบ — ทำให้มี code ที่ไม่มี caller ค้างอยู่ใน codebase เพิ่มขนาด bundle และสร้างความสับสน

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/ai.controller.ts` | ลบ endpoints: `POST /ai/extract`, `POST /ai/callback`, `GET /ai/migration`, `PATCH /ai/migration/:publicId` |
| `backend/src/modules/ai/ai.service.ts` | ลบ methods: `extractRealtime()`, `handleWebhookCallback()`, `getMigrationList()`, `updateMigrationLog()` + n8n webhook config + HttpService |
| `backend/src/modules/ai/ai.module.ts` | ลบ `HttpModule` import (ไม่ใช้แล้ว) |
| `backend/src/modules/ai/ai.service.spec.ts` | ลบ 9 dead tests (28→19), ลบ stale imports/mocks (`MigrationLog`, `HttpService`, `MigrationUpdateDto`, `AiCallbackDto`, `MigrationLogStatus`) |
| `backend/src/modules/ai/entities/migration-log.entity.ts` | **ลบไฟล์** |
| `backend/src/modules/ai/dto/extract-document.dto.ts` | **ลบไฟล์** |
| `backend/src/modules/ai/dto/migration-query.dto.ts` | **ลบไฟล์** |
| `backend/src/modules/ai/dto/migration-update.dto.ts` | **ลบไฟล์** |
| `backend/src/common/config/env.validation.ts` | ลบ `AI_N8N_WEBHOOK_URL`, `AI_N8N_AUTH_TOKEN`, `APP_BASE_URL` validation |
| `backend/.env.example` | ลบ `AI_N8N_WEBHOOK_URL`, `AI_N8N_AUTH_TOKEN`, `APP_BASE_URL` + อัปเดต comment (ADR-023/023A → ADR-023) |
| `frontend/app/(admin)/admin/migration/page.tsx` | ลบ `AiMigrationTab` + dead imports (`Textarea`, `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `XCircleIcon`, `uuidv4`) |
| `frontend/lib/services/ai.service.ts` | ลบ `extract()`, `getMigrationList()`, `updateMigration()` methods |
| `frontend/lib/services/__tests__/ai.service.test.ts` | ลบ tests สำหรับ dead methods |
| `frontend/types/ai.ts` | ลบ `AiMigrationLogStatus`, `AiMigrationLog`, `ExtractDocumentDto`, `AiMigrationUpdateDto`, `AiPaginatedResult` types |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | ลบ `migration_logs` table definition |
| `specs/03-Data-and-Storage/deltas/2026-08-20-uuid-column-comments-v1-v7.sql` | ลบ `migration_logs` references ที่เหลืออยู่ |
| `specs/03-Data-and-Storage/deltas/2026-08-25-drop-migration-logs-table.sql` | **สร้างใหม่** — delta สำหรับ DROP TABLE (พร้อม safeguards + verification) |

### สงวนไว้ (ไม่ลบ)

- `backend/src/modules/ai/dto/ai-callback.dto.ts` — `AiValidationService` ยังอ้างอิง `AiCallbackDto`
- `AI_N8N_SERVICE_TOKEN` env var — `ServiceAccountGuard` ยังใช้สำหรับ `legacy-migration/ingest`
- `frontend/types/ai.ts` `ExtractionResult` type — `DocumentComparisonView` ยัง import อยู่ (จะ clean up ใน D162)

## กฎที่ Lock แล้ว

- **D161**: Obsolete `migration_logs` pipeline ถูกลบทั้งหมด — ห้ามเพิ่มกลับมา; ระบบใช้ BullMQ + `migration_review_queue` ตาม ADR-023/023A เท่านั้น
- **D161a**: `AiCallbackDto` สงวนไว้เพราะ `AiValidationService` ยังใช้ — ห้ามลบจนกว่า `AiValidationService` จะถูก refactor ออก
- **D161b**: `AI_N8N_SERVICE_TOKEN` สงวนไว้เพราะ `ServiceAccountGuard` ยังใช้สำหรับ `legacy-migration/ingest` endpoint
- **D161c**: `ExtractionResult` type ใน `frontend/types/ai.ts` สงวนไว้ชั่วคราวเพราะ `DocumentComparisonView` ยัง import — รอ D162 cleanup

## Verification

- [x] Backend typecheck: 0 errors (หลัง restore `ai-callback.dto.ts` + `Job` import)
- [x] Backend ESLint: 0 errors (`ai.service.spec.ts` ลบ stale imports/mocks แล้ว)
- [x] Backend tests: 2 suites, 19 tests passed (ลดจาก 28 — ลบ 9 dead tests)
- [x] Frontend typecheck: 0 errors (หลัง restore `ExtractionResult` type)
- [x] Frontend ESLint: 0 errors (หลังลบ unused imports จาก migration page)
- [x] Frontend build: 49 static pages generated successfully
- [x] Database verify: `migration_logs` table ไม่มีอยู่ใน DB (ไม่เคยถูกสร้าง หรือถูก drop ไปแล้ว)
- [x] Commit `6745867f` pushed to `origin/main` (`b0110914..6745867f`)
- [ ] **Gitea Actions deploy** — pending CI/CD pipeline
- [ ] **Browser verify** — `/admin/migration` แสดงเฉพาะ Legacy Management UI (ไม่มี AI Migration Logs tab)
