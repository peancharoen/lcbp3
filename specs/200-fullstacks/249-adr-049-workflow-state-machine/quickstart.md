# Quickstart: ADR-049 Workflow State Machine Consolidation

**Date**: 2026-08-28
**Status**: T1 DONE, T2-T8 + Test Pending

## Prerequisites

- Node.js 20+, pnpm
- MariaDB 11.8 (schema per ADR-044)
- Redis 7+ (Redlock + cache)
- NestJS 11, Next.js 16
- รู้จัก ADR-001 (Unified Workflow Engine), ADR-049 (this feature)

## T1: Seed DSL Refactor (DONE)

ไฟล์ที่เปลี่ยน:
- `backend/src/modules/workflow-engine/workflow-dsl.service.ts` — extend interfaces
- `backend/src/database/seeds/workflow-definitions.seed.ts` — new DSL for all 4 workflows

ตรวจ:
```bash
cd backend && npx tsc --noEmit
cd backend && npx jest --testPathPatterns="workflow-engine"
```

ผล: 59 tests passed, typecheck ผ่าน

## T2: WorkflowEngineService Refactor (Next)

เป้าหมาย:
- Engine เขียน `statusProjection` ลง entity column ตอน transition
- รองรับ `impersonated` + `on_behalf_of` ใน `workflow_histories`
- ลบ `processAction()` legacy หลัง caller migrate

ไฟล์:
- `backend/src/modules/workflow-engine/workflow-engine.service.ts`
- `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts`

## T3: Schema Delta

สร้าง SQL delta ใน `specs/03-Data-and-Storage/deltas/delta-adr-049-workflow-impersonation.sql`:
- ปรับ `rfa_approve_codes` (4 codes ใหม่, ลบ 5N)
- สร้าง `rfa_consent_reasons`
- เพิ่ม `impersonated` + `on_behalf_of_user_id` + `on_behalf_of_user_uuid` ใน `workflow_histories`

## T4: RfaService Refactor

เป้าหมาย:
- `submit()` ส่ง action `SUBMIT` ใหม่
- `processAction()` รองรับ action ใหม่ทั้งหมด (CONSENT_FOR_APPROVE, ASK_DESIGNER, etc.)
- จัดการ revision ใหม่ตอน REVISE_REQUIRED

ไฟล์:
- `backend/src/modules/rfa/rfa.service.ts`

## T5: Remove statusMap + Dead Code

ลบ:
- `statusMap` dict ใน `CirculationWorkflowService.syncStatus`
- `statusMap` dict ใน `CorrespondenceWorkflowService.syncStatus`
- `RfaWorkflowService` ทั้งไฟล์ (dead code)

## T6: Update Constants

ไฟล์:
- `backend/src/modules/rfa/constants/rfa.constants.ts`

เปลี่ยน:
- `OWNER_REVIEW` → `OWNER_APPROVAL`
- `DEFAULT_APPROVED_CODE = '1A'` → scheme ใหม่
- เพิ่ม RFA-specific state constants

## Test

```bash
cd backend && npx jest --testPathPatterns="workflow-engine|rfa"
cd backend && npx jest --testPathPatterns="e2e"
```

เป้า: coverage 80%+ business logic, 70%+ backend
