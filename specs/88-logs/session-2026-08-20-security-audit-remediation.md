# Session 2026-08-20 — Security Audit Remediation (Feature 244)

## Summary

แก้ไข security findings ทั้ง 14 ข้อจาก security audit report ของ Feature 244 (Native Backend Legacy Ingestion) ครอบคลุม OWASP Top 10, CASL/RBAC, file upload safety, ADR-016 compliance, และ backend/frontend security; รัน full verification suite ผ่านทั้งหมด (backend build + 1033 tests, frontend typecheck + lint + 969 tests + production build)

## ปัญหาที่พบ (Root Cause)

Security audit รายงาน 14 findings (2 Critical, 4 High, 5 Medium, 3 Low):

1. **SEV-001 Critical** — Migration Excel upload ไม่มี file type/size validation
2. **SEV-002 Critical** — ไม่มี ClamAV integration ทั้งที่ ADR-016 กำหนด
3. **SEV-003 High** — `POST /migration/queue` ไม่มี `Idempotency-Key`
4. **SEV-004 High** — `POST /migration/errors` ไม่มี `Idempotency-Key`
5. **SEV-005 High** — AI legacy migration ingest รับไฟล์สูงสุด 25 ไฟล์โดยไม่ validate
6. **SEV-006 High** — Numbering metrics controller มี guards ถูก comment out
7. **SEV-007 Medium** — Frontend ใช้ `dangerouslySetInnerHTML` โดยไม่ sanitize
8. **SEV-008 Medium** — bcrypt ใช้ default 10 rounds แทน 12
9. **SEV-009 Medium** — `resolveBatch` ไม่รับ current user context สำหรับ audit
10. **SEV-010 Medium** — `triggerRagBatch` ไม่รับ current user context สำหรับ audit
11. **SEV-011 Medium** — Swagger UI exposed ใน production
12. **SEV-012 Low** — Audit รายงาน missing file existence check (false positive — มีอยู่แล้ว)
13. **SEV-013 Low** — Health endpoint exposed DB/memory/disk details โดยไม่ auth
14. **SEV-014 Low** — Seed users ใช้ shared default password โดยไม่บังคับเปลี่ยน

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/migration.controller.ts` | SEV-001: เพิ่ม `ParseFilePipe` + `MaxFileSizeValidator` (50MB) + `FileTypeValidator` (xlsx) บน `uploadExcelFile` |
| `backend/src/common/clamav/clamav.service.ts` | SEV-002: สร้าง ClamAV service (TCP INSTREAM protocol, no npm dep) |
| `backend/src/common/clamav/clamav.module.ts` | SEV-002: Global ClamAV module |
| `backend/src/common/file-storage/file-storage.service.ts` | SEV-002: เรียก ClamAV scan หลังเขียน temp file; ลบไฟล์ + reject ถ้าพบ malware |
| `backend/src/common/config/env.validation.ts` | SEV-002: เพิ่ม `CLAMAV_ENABLED`/`CLAMAV_HOST`/`CLAMAV_PORT`/`CLAMAV_TIMEOUT_MS` |
| `backend/src/app.module.ts` | SEV-002: Register ClamAVModule |
| `specs/04-Infrastructure-OPS/docker-compose-clamav-snippet.yml` | SEV-002: Docker Compose snippet สำหรับ ClamAV service |
| `backend/src/modules/migration/migration.controller.ts` | SEV-003/004: เพิ่ม `Idempotency-Key` header requirement บน `enqueueRecord` + `createError` |
| `backend/src/modules/ai/ai.controller.ts` | SEV-005: เพิ่ม `ParseFilePipe` + `MaxFileSizeValidator` (50MB) + `FileTypeValidator` (PDF) บน `ingestLegacyMigration` ด้วย `fileIsRequired: false` |
| `backend/src/modules/document-numbering/controllers/numbering-metrics.controller.ts` | SEV-006: Uncomment + อัปเกรดเป็น `JwtAuthGuard` + `RbacGuard` + `@RequirePermission('system.view_logs')` |
| `frontend/components/search/results.tsx` | SEV-007: เพิ่ม `dompurify` + `sanitizeHighlight()` อนุญาตเฉพาะ `<em>`, `<strong>` |
| `backend/src/common/auth/auth.service.ts` | SEV-008: `bcrypt.genSalt()` → `bcrypt.genSalt(12)` |
| `backend/src/modules/user/user.service.ts` | SEV-008: `bcrypt.genSalt()` → `bcrypt.genSalt(12)` |
| `backend/src/database/seeds/user.seed.ts` | SEV-008: `bcrypt.genSalt()` → `bcrypt.genSalt(12)` |
| `backend/src/modules/migration/migration.controller.ts` | SEV-009/010: เพิ่ม `@CurrentUser() user: User` ใน `resolveBatch` + `triggerRagBatch` + audit log |
| `backend/src/main.ts` | SEV-011: Gate Swagger UI ด้วย `NODE_ENV !== 'production'` |
| `backend/src/modules/monitoring/controllers/health.controller.ts` | SEV-013: `/ping` public (liveness), `/health` require `JwtAuthGuard` |
| `backend/src/modules/user/entities/user.entity.ts` | SEV-014: เพิ่ม `mustChangePassword` column |
| `backend/src/common/auth/auth.service.ts` | SEV-014: Return `mustChangePassword` flag ใน login response |
| `backend/src/database/seeds/user.seed.ts` | SEV-014: Set `mustChangePassword: true` สำหรับ seed users |
| `specs/03-Data-and-Storage/deltas/2026-08-20-add-must-change-password-to-users.sql` | SEV-014: SQL delta สำหรับ `must_change_password` column |
| `backend/src/modules/migration/migration.controller.spec.ts` | อัปเดต tests สำหรับ `@CurrentUser()` parameter + `mustChangePassword` field |

## กฎที่ Lock แล้ว

- **D122 — ClamAV TCP INSTREAM Pattern**: ใช้ TCP socket connection โดยตรง (ไม่ใช้ npm package) ส่ง `zINSTREAM` + file bytes + `zINSTREAM\0` terminator; fail-closed เมื่อ `CLAMAV_ENABLED=true` และ scan error; fail-open เมื่อ `CLAMAV_ENABLED=false`
- **D123 — ParseFilePipe fileIsRequired Pattern**: NestJS 11 `ParseFilePipe` ใช้ `fileIsRequired: boolean` (ไม่ใช่ `optional: boolean`) สำหรับ optional file arrays; `fileIsRequired: false` อนุญาต empty array แต่ validate ทุกไฟล์ที่ส่งมา
- **D124 — Swagger Production Gating**: Swagger UI ต้อง gate ด้วย `NODE_ENV !== 'production'` เท่านั้น; production ต้องไม่ expose `/docs`
- **D125 — Health Endpoint Tiering**: `/ping` public (liveness, no infra details), `/health` require JWT (detailed DB/memory/disk diagnostics)
- **D126 — bcrypt 12 Rounds**: ทุก `bcrypt.genSalt()` call ต้องระบุ `12` อย่างชัดเจน (auth, user create/update, seed)
- **D127 — DOMPurify for dangerouslySetInnerHTML**: ห้ามใช้ `dangerouslySetInnerHTML` โดยไม่ผ่าน DOMPurify; allowlist เฉพาะ tags ที่จำเป็น (`<em>`, `<strong>`)

## Verification

- [x] Backend build (`nest build`) — PASS
- [x] Backend tests (1033 tests) — 1033/1033 passed
- [x] Frontend typecheck (`tsc --noEmit`) — PASS
- [x] Frontend lint (`eslint --max-warnings 0`) — PASS
- [x] Frontend tests (969 tests) — 969/969 passed
- [x] Frontend production build (`next build`) — PASS (49 pages)
- [x] DB deltas applied สำหรับ `must_change_password` + `ai_failed` + `ocr_text` + migration RBAC permissions (216-220)
- [x] Canonical schema + data dictionary + seed files updated
