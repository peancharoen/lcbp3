# Session — 2026-09-12 (RAG Admin Console Test Plan Phase 4+5)

## Summary

Phase 4 (Performance) + Phase 5 (Security & RBAC) ของ RAG Admin Console unified test plan (`specs/999-test-plan/rag-admin-console-unified-test-plan.md`) — วัด performance จริงบน production browser + สร้าง 19 security E2E tests ครอบคลุม RBAC, UUID compliance, AI boundary, idempotency, error handling.

## ปัญหาที่พบ (Root Cause)

ไม่มี production bug ใหม่ใน Phase นี้ — เป็นการเพิ่ม test coverage และ verify performance จริง.

Performance วัดจาก production browser (Playwright MCP) พบว่าทุก API endpoint ตอบใน 76-96ms (เกณฑ์ SC-001/002/005/006/007 กำหนด 3-30 วินาที) — มี margin มาก.

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `backend/test/rag-admin-security.e2e-spec.ts` | สร้างใหม่ — 19 security E2E tests (5A RBAC, 5B UUID, 5C AI boundary, 5D idempotency, 5E error handling) |
| `specs/999-test-plan/rag-admin-console-unified-test-plan.md` | เพิ่ม Phase 4 Results + Phase 5 Results tables |

## กฎที่ Lock แล้ว

ไม่มี decision ใหม่ที่ต้อง lock — Phase 4+5 เป็น test coverage ไม่มี production code change.

## Verification

- [x] Phase 4A: Dashboard load 343ms (FCP 288ms) — well under 3s (SC-001)
- [x] Phase 4A: All 5 API endpoints 76-96ms — well under SC thresholds
- [x] Phase 4A: Console 0 errors, 0 warnings
- [x] Phase 4B: Query uses ROW_NUMBER() on indexed columns (idx_rag_generation_attachment, idx_rag_generation_status) — no full table scan
- [x] Phase 5A: 5 RBAC tests pass (viewer→403, rag.manage→403 on write, rag.retry→200, superadmin→all)
- [x] Phase 5B: 4 UUID compliance tests pass (publicId only, no INT id, no generationUuid, invalid UUID→400)
- [x] Phase 5C: 4 AI boundary tests pass (AiEnabledGuard on write, read-only unaffected)
- [x] Phase 5D: 3 idempotency tests pass (missing/empty Idempotency-Key → 400)
- [x] Phase 5E: 3 error handling tests pass (404 no stack trace, invalid UUID→400, FR-018 graceful degradation)
- [x] All 19 security E2E tests pass (1 suite)
- [x] All 51 RAG admin E2E tests pass (9 suites)
- [x] Frontend code audit: no `parseInt()` on UUID, no `id ?? ''` fallback in RAG console (ADR-019 compliant)

## Commits

```
ff5318c2 test(rag-admin): Phase 3 integration tests — 11 new E2E tests
1570184e test(rag-admin): Phase 4+5 — performance verification + security & RBAC E2E tests
```

## ข้อจำกัด

- Phase 4A performance วัดจาก production ที่มีข้อมูล 6 attachments (ไม่ได้ seed 500+ จริง) — แต่ query ใช้ indexed ROW_NUMBER() ที่รองรับ 500+ ได้
- Phase 4B ไม่ได้รัน EXPLAIN จริงบน DB — ตรวจจาก query code + schema indexes
- Phase 5 tests ใช้ mocked services (NestJS TestingModule + Supertest) — ไม่ได้ทดสอบกับ DB/Qdrant/Redis จริง
- Phase 5A.5 (document.classification_override) อยู่บน RagAttachmentController ไม่ใช่ RagAdminController — ครอบคลุมใน Phase 1 frontend test แล้ว
