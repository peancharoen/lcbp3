# Session 2026-09-11 — Feature 255 RAG Admin Console Code Review Remediation

## Summary

ทำ Antigravity Code Review ของ Feature 255 (RAG Admin Console) หลัง merge เข้า main พบ 4 CRITICAL runtime bugs + 3 HIGH + 4 MEDIUM issues แล้วแก้ทั้งหมดใน commit เดียว (`2e1702fa`)

## ปัญหาที่พบ (Root Cause)

### CRITICAL (4 runtime bugs — ทั้งหมด masked โดย E2E tests ที่ mock service ทั้งหมด)

1. **`a.effectiveClassification` ไม่ถูก map บน entity** — `Attachment` entity มี `classification` แต่ service query เลือก `a.effectiveClassification` (DB column `effective_classification` มีอยู่จริงใน schema แต่ไม่ถูก map บน entity) → TypeORM จะ throw ตอน runtime
2. **`a.projectPublicId` ไม่มีอยู่จริง** — `attachments` table ไม่มี `project_public_id` column (มีแค่ใน `rag_attachment_chunks`) → SQL error ตอนใช้ filter; ปัญหาคือ attachments เชื่อมกับ project ผ่าน correspondence chain ไม่ใช่ direct FK
3. **`fetchClassificationOverrides` query column ที่ไม่มีใน `audit_logs`** — เลือก `before_value`, `after_value`, `reason`, `actor_name` แต่ `audit_logs` table มีแค่ `entity_type`, `entity_id`, `action`, `details_json`; override data จริงอยู่ใน `attachments` table เอง (`classification_override_reason`, `classification_override_actor_user_public_id`, `classification_overridden_at`)
4. **`orphanScanRagAttachments` ใช้ column ผิด `a.public_id`** — ADR-019: column จริงคือ `uuid` ไม่ใช่ `public_id`; ผลคือ LEFT JOIN ไม่ match อะไรเลย → **ทุก generation ถูก treat เป็น orphan → ลบ Qdrant vectors + chunks + pages + generation records ของทุก attachment ทุก 6 ชั่วโมง (data loss bug)**

### HIGH (3 issues)

5. **i18n helper hardcode Thai** — `ragAdminT` import `th/ai.json` เสมอ ไม่รองรับ EN locale
6. **LifecycleTab SelectContent ว่างเปล่า** — มี TODO comment ไม่มี SelectItem options → US3 (lifecycle viewer + force re-ingest) ใช้งานไม่ได้
7. **Classification table แสดง override reason ซ้ำ 2 column** — "Override" column และ "Reason" column แสดง `classificationOverride.reason` เหมือนกัน

### MEDIUM (4 issues)

8. Hardcoded "Loading..." และ "Cancel" ไม่ผ่าน i18n
9. `getMetrics()` return type เป็น `unknown`
10. `reingest()` ไม่มี compensation เมื่อ BullMQ enqueue fail → dangling BUILDING generation
11. Confirmation dialogs ใช้ raw `<div>` overlay แทน shadcn Dialog component

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --------------- |
| `backend/src/common/file-storage/entities/attachment.entity.ts` | เพิ่ม `@Column` mappings สำหรับ `effectiveClassification` + 4 override columns (`classificationOverride`, `classificationOverrideReason`, `classificationOverrideActorUserPublicId`, `classificationOverriddenAt`) |
| `backend/src/modules/ai/services/rag-admin.service.ts` | (1) เพิ่ม override columns ใน select query (2) ลบ `projectPublicId` filter (3) ลบ `fetchClassificationOverrides` method + ลบ `AuditLog` dependency (4) เพิ่ม compensation try/catch ใน `reingest()` — mark generation FAILED ถ้า enqueue fail |
| `backend/src/modules/ai/dto/rag-admin.dto.ts` | ลบ `projectPublicId` จาก 3 DTOs + เพิ่ม `RagAdminMetricsSnapshotDto` interface |
| `backend/src/modules/ai/rag-admin.controller.ts` | เปลี่ยน `getMetrics()` return type จาก `unknown` เป็น `RagAdminMetricsSnapshotDto` (import type) |
| `backend/src/modules/ai/services/vector-cleanup.service.ts` | แก้ `a.public_id` → `a.uuid` ใน `orphanScanRagAttachments` LEFT JOIN |
| `backend/src/modules/ai/services/rag-admin.service.spec.ts` | ลบ `AuditLog` mock (ไม่ใช้แล้ว) |
| `frontend/components/admin/ai/rag-console/rag-admin-i18n.ts` | Refactor เป็น `useRagAdminT()` hook รองรับ en/th locale + เก็บ `ragAdminT` plain function สำหรับ backward compat |
| `frontend/app/(admin)/admin/ai/rag-console/page.tsx` | (1) ใช้ `useRagAdminT()` ในทุก component (2) ลบ project filter Select (3) populate LifecycleTab SelectContent ด้วย `useRagAttachments()` (4) แก้ "Override" column แสดง timestamp แทน reason (5) แทน hardcoded "Loading..."/"Cancel" ด้วย i18n keys (6) แทน raw `<div>` overlay ด้วย shadcn Dialog |
| `frontend/lib/services/admin-rag.service.ts` | ลบ `projectPublicId` จาก 3 param interfaces |
| `frontend/public/locales/{en,th}/ai.json` | เพิ่ม `rag.admin.common.loading` + `rag.admin.common.cancel` |
| `frontend/app/(admin)/admin/ai/rag-console/__tests__/*.test.tsx` | อัปเดต mock ให้มี `useRagAdminT` + แก้ loading state test ใช้ `common.loading` key |

## กฎที่ Lock แล้ว

| ID | Decision | ADR |
| --- | --- | --- |
| D302 | RAG Admin Console `Attachment` entity ต้อง map `effective_classification` + 4 override columns ตรงๆ (ไม่ใช้ audit_logs query) — override data อยู่ใน `attachments` table เอง ไม่ใช่ `audit_logs` | ADR-044 + ADR-016 |
| D303 | `orphanScanRagAttachments` ต้องใช้ `a.uuid` ไม่ใช่ `a.public_id` (ADR-019: `UuidBaseEntity` maps `publicId`→`uuid` column) — ผิดจะทำให้ข้อมูล RAG ทั้งหมดถูกลบ | ADR-019 |
| D304 | `attachments` table ไม่มี `project_public_id` column — ไม่สามารถ filter attachments โดย project โดยตรง; ต้อง join ผ่าน correspondence chain ถ้าต้องการในอนาคต | ADR-044 |
| D305 | RAG Admin i18n ใช้ `useRagAdminT()` hook (locale-aware) ไม่ใช่ plain `ragAdminT` function — รองรับ EN/TH switching | 05-08-i18n-guidelines |

## Verification

- [x] backend tsc: PASS (0 errors)
- [x] frontend tsc: PASS (0 errors)
- [x] backend eslint: PASS (0 errors)
- [x] frontend eslint: PASS (0 errors)
- [x] backend unit tests: 29/29 PASS
- [x] backend E2E tests: 21/21 PASS
- [x] frontend vitest: 18/18 PASS
- [x] commit `2e1702fa` บน main

## บทเรียนสำคัญ

**E2E tests ที่ mock service ทั้งหมดไม่สามารถจับ runtime bugs ได้** — ทั้ง 4 CRITICAL bugs ถูก masked เพราะ E2E tests ใช้ `useValue: mockRagAdminService` แทนการ exercise real query builder กับ real DB; ควรเพิ่ม integration test อย่างน้อย 1 test ที่รัน real service กับ test database
