# Session — 2026-09-11 (RAG Admin Console Unified Test Plan)

## Summary

สร้างแผนการทดสอบรวม (unified test plan) สำหรับฟีเจอร์ `/admin/ai/rag-console` ครอบคลุมสเปค 255 (RAG Admin Console) + 254 (RAG Attachment Chunks) + supporting specs (234, 241, 233) — ตรวจสถานะ implementation จริงใน codebase แล้วสร้าง test plan 5 Phase (Browser E2E, Backend Unit, Integration, Performance, Security & RBAC) พร้อม gap analysis

## ปัญหาที่พบ (Root Cause)

ไม่มีปัญหา — เป็นการสร้าง test plan ใหม่ ไม่ใช่ bugfix

### ช่องว่างที่พบระหว่าง audit

1. **P1: Browser E2E (Playwright) ขาด** — ทุก E2E ปัจจุบันเป็น NestJS Supertest (API-level) ไม่ได้ทดสอบ UI จริง
2. **P1: Frontend RBAC permission gating ขาด** — Classification override form แสดงเสมอ ไม่ได้เช็ค `document.classification_override` ที่ frontend (SC-008 ละเว้น)
3. **P2: Audit trail display ไม่ครบ** — Classification tab แสดง override info แต่ไม่มี dedicated audit trail display (before/after/reason/actor)
4. **P2: Service unavailable banner ไม่มี test** — `ServiceUnavailableBanner` import แล้ว แต่ไม่มี test ยืนยันแสดงเมื่อ Qdrant/Ollama down
5. **P2: Polling stop when backgrounded ไม่มี test** — Hook ตั้ง `refetchIntervalInBackground: false` แล้ว แต่ไม่มี test ยืนยัน
6. **P2: Cross-project filter ไม่มี integration test** — ไม่มี test ยืนยัน dashboard filter by project
7. **P2: Batch retry permanent error message ไม่มี test** — Edge case: permanent error (corrupted file)
8. **P2: Metrics reset confirmation dialog ไม่มี test**
9. **P3: Performance benchmark ขาด** — ไม่มี test สำหรับ SC-001 (3s) และ SC-007 (500+ attachments <3s)
10. **P3: retryIngestion location deviation** — `retryIngestion()` เป็น private method ใน `rag-admin.service.ts` ไม่ใช่ใน `rag-attachment-ingestion.service.ts` ตาม T056

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/999-test-plan/rag-admin-console-unified-test-plan.md` | สร้างไฟล์ใหม่ — unified test plan 481 บรรทัด ครอบคลุม 5 Phase, ~80 test cases, 10 gap items |

### สถานะ Implementation ที่ตรวจพบจริง

| ส่วน | สถานะ | Tests |
| --- | --- | --- |
| Backend Controller (`rag-admin.controller.ts`) | ✅ Implemented — 8 endpoints | 11 unit + 21 E2E pass |
| Backend Service (`rag-admin.service.ts`) | ✅ Implemented — listAttachments, listAttachmentsForClassification, listGenerations, reingest, listFailedIngestions, batchRetry, retryIngestion | 14 unit pass |
| Backend Orphan Cleanup (`vector-cleanup.service.ts`) | ✅ Implemented — `orphanScanRagAttachments()` | 4 unit pass |
| Frontend Page (`page.tsx`) | ✅ Implemented — 5 tabs, 668 บรรทัด | 18 pass |
| Frontend Components (7 files) | ✅ Implemented — RagStatusBadge, ClassificationBadge, GenerationTimeline, MetricsCard, RetryButton, ServiceUnavailableBanner, EmptyState, rag-admin-i18n | — |
| Frontend Hooks (`use-rag-admin.ts`) | ✅ Implemented — polling 10s + refetchIntervalInBackground: false | — |
| Frontend Service (`admin-rag.service.ts`) | ✅ Implemented — 8 endpoints | — |
| ADR-053 | ✅ Created | — |
| Permission seeds (`rag.admin.write` + `rag.retry`) | ✅ Seeded + delta SQL | — |
| i18n (`rag.admin.*` namespace) | ✅ Created — `rag-admin-i18n.ts` hook | — |

## กฎที่ Lock แล้ว

ไม่มี decision ใหม่ใน session นี้ — เป็นการสร้าง test plan เท่านั้น

## Verification

- [x] Backend unit tests 25/25 pass (`npx jest --testPathPatterns="rag-admin"`)
- [x] Backend E2E tests 21/21 pass (`npx jest --config ./test/jest-e2e.json --testPathPatterns="rag-admin"`)
- [x] Frontend tests 18/18 pass (`npx vitest run app/(admin)/admin/ai/rag-console`)
- [x] Test plan file created at `specs/999-test-plan/rag-admin-console-unified-test-plan.md` (481 บรรทัด)
- [x] Gap analysis 10 ช่องว่าง (2 P1, 6 P2, 2 P3)
- [ ] Browser E2E ผ่าน Playwright — **pending (P1 gap)**
- [ ] Frontend RBAC permission gating — **pending (P1 gap)**
