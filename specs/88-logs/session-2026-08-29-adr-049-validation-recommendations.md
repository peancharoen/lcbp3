# Session 2026-08-29 — ADR-049 Validation Recommendations 1-5

## Summary

ทำ Recommendations 1-5 จาก ADR-049 validation report ครบทั้งหมด: แทนที่ string eval ด้วย JSON Logic, เพิ่ม test coverage ให้ RFA + Workflow Engine, เพิ่ม edge case tests สำหรับ OWNER RESUBMIT + DESIGNER OBJECTED, และเปิดใช้งาน E2E tests แบบ conditional skip จากนั้น squash commit 5 ตัวเป็น commit เดียวและ push ไป Gitea `origin/main`

## ปัญหาที่พบ (Root Cause)

1. **String evaluation security risk (FR-015/SC-009)** — `workflow-dsl.service.ts` ใช้ `new Function()` สำหรับ evaluate transition conditions ทำให้เกิด code injection risk
2. **Business logic coverage below 80% target (SC-006)** — `rfa.service.ts` 59.26%, `workflow-engine.service.ts` 75.43% statements
3. **Missing edge case tests** — ไม่มี explicit test สำหรับ OWNER RESUBMIT (non-terminal loop) และ DESIGNER OBJECTED
4. **E2E tests skipped** — `rfa-workflow.e2e-spec.ts` มีแค่ placeholder `describe.skip` ไม่มีการทดสอบจริง
5. **Test mock issues** — `instanceRepo` mock ไม่มี `update` method, `defRepo.createQueryBuilder` ไม่ถูก mock อย่างถูกต้อง, method name `getAllLatestDefinitions` ผิด (จริงคือ `getDefinitions`)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/modules/workflow-engine/workflow-dsl.service.ts` | แทนที่ `new Function()` ด้วย `jsonLogic.apply()` (json-logic-js), เปลี่ยน condition type จาก `string` → `Record<string, unknown>`, เพิ่ม compile-time guard ปฏิเสธ string conditions |
| `backend/src/types/json-logic-js.d.ts` | สร้าง type declarations สำหรับ `json-logic-js` (ไม่มี bundled types) |
| `backend/src/modules/rfa/rfa.service.spec.ts` | เพิ่ม 8 tests สำหรับ `create()`: happy path, error cases, rollback, self-heal |
| `backend/src/modules/workflow-engine/workflow-engine.service.spec.ts` | เพิ่ม 15 tests สำหรับ public methods + 2 edge case tests (EC1/EC2) |
| `backend/tests/e2e/rfa-workflow.e2e-spec.ts` | เขียนใหม่: 7 DSL-level tests (no DB) + 1 DB-required test (conditional skip via `E2E_DATABASE_URL`) |
| `backend/package.json` | เพิ่ม dependency `json-logic-js@2.0.5` |
| `specs/200-fullstacks/249-adr-049-workflow-state-machine/validation-report.md` | สร้าง validation report |
| `specs/200-fullstacks/249-adr-049-workflow-state-machine/ledger.md` | เพิ่ม CP12 validation checkpoint |

## กฎที่ Lock แล้ว

- **FR-015**: Transition conditions ต้องใช้ JSON Logic เท่านั้น — ห้าม string evaluation (compile-time guard ปฏิเสธ string)
- **E2E conditional skip pattern**: ใช้ `const describeE2E = E2E_ENABLED ? describe : describe.skip` เพื่อข้าม E2E tests เมื่อไม่มี test database (รันด้วย `E2E_DATABASE_URL=mysql://... npx jest --config test/jest-e2e.json`)
- **DSL-level tests ไม่ต้องการ database**: ทดสอบ transition logic โดยตรงผ่าน `WorkflowDslService` ได้โดยไม่ต้อง bootstrap AppModule

## Verification

- [x] TypeScript: `npx tsc --noEmit` ผ่าน (0 errors)
- [x] ESLint: 0 errors ในไฟล์ที่แก้
- [x] Full test suite: 154 suites passed, 2219 tests passed, 11 skipped, 0 failed
- [x] Coverage improvement:
  - `rfa.service.ts`: 59.26% → **80.35%** statements (meets 80% target)
  - `workflow-engine.service.ts`: 75.43% → **87.83%** statements, 37.5% → **81.25%** functions
- [x] Pre-commit hook ผ่าน (eslint --fix)
- [x] Squash + push สำเร็จ: commit `c85e1704` → `origin/main` (`43931665..c85e1704`)

## Coverage Summary

| File | Before | After | Target |
|------|--------|-------|--------|
| `rfa.service.ts` | 59.26% stmts | **80.35%** stmts | 80% ✅ |
| `workflow-engine.service.ts` | 75.43% stmts | **87.83%** stmts | 80% ✅ |
| `workflow-engine.service.ts` | 37.5% funcs | **81.25%** funcs | 80% ✅ |

## Commits

5 commits squashed into 1 ผ่าน `2git.sh`:

1. `cb30c6f2` — test(backend): expand workflow engine test coverage 61% → 78%
2. `67f7d243` — fix(workflow): resolve ADR-049 code review findings
3. `c8b49634` — docs(ai): lock GPU coordination terms
4. `89a8b1d9` — chore: add 107D distributed orchestrator
5. `78a367e7` — fix(workflow): resolve ADR-049 validation recommendations 1-5

**Final squash commit**: `c85e1704` — `260829:0957 ADR-049 workflow state machine: validation recommendations + review fixes + JSON Logic + test coverage`
