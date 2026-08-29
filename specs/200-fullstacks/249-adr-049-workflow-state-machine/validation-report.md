# Validation Report: ADR-049 Workflow State Machine Consolidation

**Date**: 2026-08-29
**Validator**: Antigravity Validator (automated)
**Status**: **PARTIAL** — 15/18 functional requirements fully verified, 2 partial, 1 gap; coverage thresholds not met

## Coverage Summary

| Metric                  | Count | Percentage |
| ----------------------- | ----- | ---------- |
| Requirements Covered    | 15/18 | 83%        |
| Acceptance Criteria Met | 18/20 | 90%        |
| Edge Cases Handled      | 3/5   | 60%        |
| Tests Present           | 16/18 | 89%        |
| TDD Evidence Recorded   | 11/11 | 100%       |

## Contract Compliance

| Item                                               | Status        | Notes                                                                         |
| -------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| Ledger exists                                      | Yes           | `specs/200-fullstacks/249-adr-049-workflow-state-machine/ledger.md`           |
| Ledger STATUS                                      | open          | Not yet closed — final validation in progress                                 |
| Checkpoints complete                               | Yes (CP0-CP11) | 12 checkpoints, all `checkpoint-ready` or `ready-for-pr`                      |
| TDD evidence links                                 | Yes           | CP2-CP8 include RED→GREEN evidence with spec file references                  |
| Protected boundaries crossed without authorization | No            | No deploy, merge, push, or destructive DB operations performed                |

## Requirements Matrix

### Functional Requirements

| FR    | Description                                          | Status    | Implementation Evidence                                                                                              | Test Evidence                              |
| ----- | ---------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| FR-001 | รวม state/approval logic เป็น state machine เดียวใน DSL | **PASS**  | `workflow-definitions.seed.ts` RFA_APPROVAL v2 (8 states, 11 actions); `WorkflowEngineService.processTransition()` | T019, T024, T034, T039                     |
| FR-002 | RFA multi-party sequential approval (CONSULTANT→DESIGNER→OWNER) | **PASS**  | DSL states: DRAFT→CONSULTANT_REVIEW→DESIGNER_REVIEW→OWNER_APPROVAL→terminal; `WorkflowAction` enum has 12 actions    | T019, AGREED_WITH_COMMENTS test (review-fix) |
| FR-003 | statusProjection จาก DSL (ไม่ผ่าน statusMap dict)    | **PASS**  | `RfaService.syncRevisionStatus()` reads `result.statusProjection.rfa`; `CirculationWorkflowService.syncStatus()` reads `.circulation`; `CorrespondenceWorkflowService.syncStatus()` reads `.correspondence` | T019, T024                                 |
| FR-004 | approve code scheme 1/2/3/4 ผูกกับ transition ใน DSL | **PASS**  | DSL transitions have `approveCode` field; engine validates `WORKFLOW_APPROVE_CODE_MISMATCH`; `RfaService` persists `effectiveApproveCode` (review-fix: REJECT no longer special-cased) | T019, T034, REJECT approve code 4 test     |
| FR-005 | ลบ approve code `5N` — ยกเลิกใช้ `cancel()`          | **PASS**  | SQL delta soft-deactivates `5N` + `1A/1C/1N/1R/3C/3R/4X`; `RfaService.cancel()` sets status CC                        | No direct test (schema delta)              |
| FR-006 | consent reason แยกใน `rfa_consent_reasons` (metadata) | **PASS**  | `rfa_consent_reasons` table + entity; `RfaService.processAction()` validates + persists to `revision.details.consentReasonCode` | T026/T029                                  |
| FR-007 | CASL coarse gate + DSL `require.role` fine-grained   | **PASS**  | `workflow-transition.guard.ts` has `DSL_ROLE_TO_CASL` mapping + Level 3 assigned-handler check                       | T039 (CONSULTANT rejected from APPROVE)    |
| FR-008 | Superadmin/Org Admin ทำ action แทน                   | **PASS**  | `WorkflowEngineService` checks `system.manage_all` + `organization.manage_users`; `RfaService` resolves `impersonatedUserId` UUID→INT | T033a (non-admin rejected)                 |
| FR-009 | บันทึก impersonated + on_behalf_of ใน history        | **PASS**  | `workflow-history.entity.ts` has `impersonated`, `onBehalfOfUserId`, `onBehalfOfUserUuid` columns; engine writes all three | T033a, T033b                               |
| FR-010 | REVISE_REQUIRED terminal                              | **PASS**  | DSL marks `REVISE_REQUIRED` as terminal; engine sets `status=COMPLETED`                                               | T034                                       |
| FR-011 | revision ใหม่ = workflow instance ใหม่               | **PASS**  | `RfaService.createRevision()` checks old instance terminal, calls `workflowEngine.createInstance()` for new instance  | T035/T036                                  |
| FR-012 | ลบ statusMap dict 4 ชุด                               | **PASS**  | `grep` confirms no `STATE_TO_STATUS_MAP` or `statusMap` in module services (only comment reference remains)           | T024 (statusProjection test)               |
| FR-013 | ลบ `RfaWorkflowService` (dead code)                  | **PASS**  | `ls` confirms `rfa-workflow.service.ts` deleted; `rfa-workflow-template.entity.ts` deleted                            | CP9 full suite pass                        |
| FR-014 | ลบ `processAction()` legacy ใน `WorkflowEngineService` | **PASS**  | `grep` confirms no `processAction` in engine; legacy `WorkflowAction` enum + `TransitionResult` deleted (review-fix)  | CP9 full suite pass                        |
| FR-015 | JSON Logic สำหรับ transition condition (ห้าม string eval) | **PARTIAL** | RFA_APPROVAL v2 DSL uses no string conditions (human decisions only); BUT `workflow-dsl.service.ts:310` still has `new Function()` for other workflows | No test for string eval rejection          |
| FR-016 | history บันทึก actor/action/from-state/to-state/approveCode/impersonation | **PASS**  | `workflow-history.entity.ts` has all columns; engine writes all fields at lines 520-540                               | T019, T033a, T033b                         |
| FR-017 | Redis Redlock + pessimistic lock + CAS version        | **PASS**  | `WorkflowEngineService` uses Redlock (retry 3x→503), query runner lock, `version_no` CAS check                       | T024a (fast-fail), T024b (CAS TOCTOU)      |
| FR-018 | workflow events ผ่าน BullMQ `workflow-events` queue   | **PASS**  | `WorkflowEventService` injects `@InjectQueue('workflow-events')`; engine calls `eventService.dispatchEvents()`        | No direct unit test (integration deferred) |

### Success Criteria

| SC    | Description                                          | Status        | Evidence                                                                                                             |
| ----- | ---------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| SC-001 | ทุก RFA transition ควบคุมโดย state machine เดียวใน DSL | **PASS**      | All 11 RFA actions defined in seed DSL; engine `processTransition()` is single entry point                           |
| SC-002 | status ถูกต้องโดยไม่มี statusMap dict               | **PASS**      | `grep` confirms no statusMap dicts; `syncRevisionStatus`/`syncStatus` read from `statusProjection`                   |
| SC-003 | approve code ถูกต้องตาม transition ทุกครั้ง           | **PASS**      | Engine validates `approveCode` against DSL; review-fix removed REJECT special-casing                                 |
| SC-004 | admin impersonation audit trail 100%                 | **PASS**      | Engine writes `impersonated` + `onBehalfOfUserId` + `onBehalfOfUserUuid` + `onBehalfOfUserActive` to history         |
| SC-005 | revision ใหม่ได้ instance ใหม่ 100%                   | **PASS**      | `createRevision()` calls `createInstance()` after verifying terminal                                                 |
| SC-006 | business logic coverage ≥ 80%                         | **PARTIAL**   | `workflow-engine.service.ts` 75.43% stmts; `rfa.service.ts` 59.26% stmts — below 80% target                          |
| SC-007 | backend coverage ≥ 70% overall                        | **PASS**      | Global: 77.91% stmts, 67.04% branches — statements pass, branches below 70%                                          |
| SC-008 | ไม่มี `processAction()` legacy และ `RfaWorkflowService` | **PASS**      | Both deleted; `grep` confirms no references                                                                           |
| SC-009 | transition condition ใช้ JSON Logic (ไม่มี string eval) | **PARTIAL**   | RFA DSL clean; `workflow-dsl.service.ts:310` still has `new Function()` for non-RFA workflows                         |
| SC-010 | concurrent transition ปลอดภัย (Redlock + CAS)         | **PASS**      | T024a/T024b test fast-fail and CAS TOCTOU; Redlock mock tests acquire/release                                         |

### Acceptance Scenarios

| US  | Scenario                                          | Status    | Test Reference                                       |
| --- | ------------------------------------------------- | --------- | ---------------------------------------------------- |
| US1 | 1. DRAFT→SUBMIT→CONSULTANT_REVIEW (rfa=FRE)       | **PASS**  | `rfa.service.spec.ts` submit test (line 645)         |
| US1 | 2. CONSULTANT_REVIEW→CONSENT_FOR_APPROVE→OWNER_APPROVAL | **PASS**  | T026/T029 consent reason test                        |
| US1 | 3. CONSULTANT_REVIEW→ASK_DESIGNER→DESIGNER_REVIEW | **PASS**  | DSL seed defines transition; engine processes it     |
| US1 | 4. DESIGNER_REVIEW→AGREED→CONSULTANT_REVIEW       | **PASS**  | review-fix: AGREED_WITH_COMMENTS test added          |
| US1 | 5. OWNER_APPROVAL→APPROVE→APPROVED (code 1)       | **PASS**  | T019                                                 |
| US1 | 6. OWNER_APPROVAL→APPROVE_WITH_COMMENTS (code 2)  | **PASS**  | T019 variant (mock approveCode='2')                  |
| US1 | 7. OWNER_APPROVAL→REJECT→REJECTED (code 4)        | **PASS**  | review-fix: REJECT approve code 4 test added         |
| US2 | 1. RFA status DFT→FRE from DSL                    | **PASS**  | T019, T024                                           |
| US2 | 2. Circulation status OPEN→IN_REVIEW from DSL     | **PASS**  | T024 (engine returns statusProjection)               |
| US2 | 3. Correspondence status DRAFT→SUBOWN from DSL    | **PASS**  | T024 (engine returns statusProjection)               |
| US2 | 4. ลบ statusMap dict → test ยังผ่าน                | **PASS**  | CP4 checkpoint; no statusMap in code                 |
| US3 | 1. APPROVE→approve_code_id=1                      | **PASS**  | T019                                                 |
| US3 | 2. APPROVE_WITH_COMMENTS→approve_code_id=2        | **PASS**  | T019 variant                                         |
| US3 | 3. CONSENT_FOR_APPROVE→consent reason saved, approve_code NULL | **PASS**  | T026/T029                                           |
| US3 | 4. 5N ถูกลบจาก schema                              | **PASS**  | SQL delta soft-deactivates 5N                        |
| US4 | 1. Superadmin APPROVE แทน OWNER→impersonated=true | **PASS**  | T033a (permission check), T033b (inactive handler)   |
| US4 | 2. Org Admin action แทน→on_behalf_of_user_uuid    | **PASS**  | Engine returns `onBehalfOfUserPublicId`              |
| US4 | 3. ผู้ใช้ทั่วไปถูกปฏิเสธ                            | **PASS**  | T033a                                                |
| US5 | 1. CONSULTANT RESUBMIT→REVISE_REQUIRED (code 3)   | **PASS**  | T034                                                 |
| US5 | 2. REVISE_REQUIRED→revision ใหม่→instance ใหม่    | **PASS**  | T035/T036                                            |
| US5 | 3. 3 revisions แต่ละ revision มี instance          | **PARTIAL** | T035/T036 tests single revision cycle; multi-revision not explicitly tested |
| US6 | 1. CONSULTANT ใน OWNER_APPROVAL→APPROVE ถูกปฏิเสธ  | **PASS**  | T039                                                 |
| US6 | 2. ไม่มี project access→CASL ปฏิเสธ                | **PASS**  | Guard Level 1 test                                   |
| US6 | 3. Editor SUBMIT→ผ่านทั้ง CASL และ DSL             | **PASS**  | Guard Level 3 test                                   |
| US7 | 1. ลบ processAction() legacy→test ผ่าน             | **PASS**  | CP9                                                  |
| US7 | 2. ลบ RfaWorkflowService→build ผ่าน               | **PASS**  | CP9                                                  |
| US7 | 3. ลบ statusMap dict→status ยังถูกต้อง             | **PASS**  | CP4                                                  |

### Edge Cases

| #  | Edge Case                                          | Status        | Handling Code                                                        | Test                          |
| -- | -------------------------------------------------- | ------------- | -------------------------------------------------------------------- | ----------------------------- |
| 1  | OWNER_APPROVAL→RESUBMIT (วนกลับ, ไม่ terminal)    | **PARTIAL**   | DSL defines OWNER RESUBMIT→CONSULTANT_REVIEW with approveCode 3; engine handles non-terminal transitions | Not explicitly tested        |
| 2  | DESIGNER OBJECTED→CONSULTANT_REVIEW with comment   | **PARTIAL**   | DSL defines OBJECTED→CONSULTANT_REVIEW; engine processes comment     | Not explicitly tested        |
| 3  | Superadmin action แทน แต่ handler deactivated      | **PASS**      | Engine writes `onBehalfOfUserActive=false` to metadata               | T033b                         |
| 4  | Concurrent transition (สองคนกดพร้อมกัน)           | **PASS**      | Redlock + pessimistic lock + CAS version                             | T024a, T024b                  |
| 5  | DSL version ใหม่ deploy ระหว่าง instance active    | **PASS**      | Instance loads `relations: ['definition']` → uses pinned `compiled` snapshot | T024a (version mismatch)     |

## Uncovered Requirements

| Requirement | Status    | Notes                                                                                                                              |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FR-015      | PARTIAL   | `workflow-dsl.service.ts:310` still uses `new Function()` for string eval. RFA DSL v2 doesn't use conditions, but the engine path exists for other workflows. |
| SC-006      | PARTIAL   | `workflow-engine.service.ts` 75.43% statements (target 80%); `rfa.service.ts` 59.26% statements (target 80%). Branch coverage 67.04% (target 70%). |
| SC-009      | PARTIAL   | Same as FR-015 — string eval path exists in DSL service for non-RFA workflows.                                                     |

## Test Coverage Details

| Module                           | Statements | Branches | Functions | Lines   | Target (SC-006) |
| -------------------------------- | ---------- | -------- | --------- | ------- | --------------- |
| `workflow-engine.service.ts`     | 75.43%     | 69.07%   | 37.5%     | 75.43%  | 80%             |
| `rfa.service.ts`                 | 59.26%     | 53.12%   | 81.25%    | 59.26%  | 80%             |
| `workflow-transition.guard.ts`   | 95.08%     | 78.94%   | 100%      | 95.08%  | 80% ✅           |
| `rfa.constants.ts`               | 100%       | 100%     | 100%      | 100%    | 80% ✅           |
| `workflow.interface.ts`          | 100%       | 100%     | 100%      | 100%    | 80% ✅           |
| **Global (SC-007)**              | **77.91%** | **67.04%** | **63.52%** | **77.91%** | **70%** ✅ (stmts) |

**Test counts**: 153 suites passed, 2184 tests passed, 13 skipped (E2E skeletons), 0 failed.

## Positive Observations

1. **Clean DSL-driven architecture**: Single `processTransition()` entry point with status projection, approve code validation, and impersonation audit — well-structured.
2. **Comprehensive TDD evidence**: 11 checkpoints with RED→GREEN evidence links in the ledger; tests are permanent in spec files.
3. **Defense-in-depth RBAC**: CASL coarse gate + DSL `require.role` fine-grained check + Level 3 assigned-handler verification — 4-level layering.
4. **Concurrency protection intact**: Redlock + pessimistic lock + CAS version — all three layers tested (T024a/T024b).
5. **Review-fix improvements**: AGREED_WITH_COMMENTS action unblocked, REJECT approve code 4 now persists, createRevision returns UUID, impersonationReason flows to audit metadata.
6. **Schema delta follows ADR-044**: Direct SQL with rollback file, soft-delete of old approve codes preserves audit history.

## Recommendations

### Must fix before merge (gaps)

1. **FR-015/SC-009 — Remove or gate string eval path**: `workflow-dsl.service.ts:310` uses `new Function()`. Either:
   - Replace with JSON Logic evaluator (per ADR-001), OR
   - Add a compile-time guard that rejects DSL with `condition` field and only allows JSON Logic expressions

2. **SC-006 — Close coverage gap for `rfa.service.ts`**: Currently 59.26% statements. The uncovered ranges (lines 115-559, 199-559) include `create()`, `update()`, and `cancel()` methods. Add tests for:
   - `create()` happy path + drawing constraints validation
   - `update()` field mapping
   - `cancel()` status check + CC status lookup

3. **SC-006 — Close coverage gap for `workflow-engine.service.ts`**: Currently 75.43% statements, 37.5% functions. Uncovered ranges include `createDefinition()`, `update()`, `getAvailableActions()`, `cancelInstance()`. Add tests for these public methods.

### Should address (edge case gaps)

4. **Edge case 1 — OWNER RESUBMIT non-terminal**: Add test verifying OWNER RESUBMIT transitions to CONSULTANT_REVIEW (not terminal) with approve code 3, and workflow instance remains active.

5. **Edge case 2 — DESIGNER OBJECTED**: Add test verifying OBJECTED transitions to CONSULTANT_REVIEW with DESIGNER comment preserved in history.

6. **US5 scenario 3 — Multi-revision history**: Add test creating 3 revisions and verifying each has its own workflow instance, all queryable via `rfa_revisions.rfa_id`.

### Consider for later

7. **E2E tests**: The 3 E2E skeleton tests (`rfa-workflow.e2e-spec.ts`) remain skipped. Enable when test environment (MariaDB + Redis + Seed) is available.

8. **Branch coverage**: Global branch coverage is 67.04% (target 70%). Focus on `rfa.service.ts` branch coverage (53.12%) to close the gap.

9. **Function coverage**: `workflow-engine.service.ts` function coverage is 37.5% — several public methods (`createDefinition`, `update`, `getAvailableActions`, `cancelInstance`) lack tests.

## Exit Status

**Coverage threshold**: 80% requirement coverage → 83% (15/18) → **PASS**
**Overall verdict**: **PARTIAL** — Functionally complete for RFA workflow, but FR-015 (string eval) and SC-006 (coverage) need resolution before final merge.
