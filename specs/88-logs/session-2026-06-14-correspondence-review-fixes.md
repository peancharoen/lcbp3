# Session — 2026-06-14 (Correspondence Module Review Fixes + RFA ADR-001/021 Refactor)

## Summary

สองงานหลักใน session นี้:
1. **Correspondence Module Code Review Fixes** — แก้ทุก item จาก `speckit-reviewer` report (HIGH + MEDIUM + Remaining)
2. **RFA Service ADR-001/021 Migration** — User refactor `rfa.service.ts` ตัด deprecated routing-template entities ออก และ rewire workflow ผ่าน Unified Workflow Engine

---

## Part 1: Correspondence Module Review Fixes

### ปัญหาที่พบ (Root Cause)

รายการจาก code review report ที่ต้องแก้ไข:

| # | Severity | ปัญหา |
|---|----------|-------|
| 1 | HIGH | `throw new Error` ใน `processAction` — ละเมิด ADR-007 |
| 2 | HIGH | CSV export capped ที่ 10 rows เพราะ `findAll` ใช้ default `limit: 10` |
| 3 | MEDIUM | `bulkCancel` empty `catch {}` — ไม่ log error |
| 4 | MEDIUM | `escapeCsv` ไม่กัน formula injection (OWASP) |
| 5 | MEDIUM | `update()` re-index search ด้วย hardcoded `status: 'DRAFT'` |
| 6 | LOW | `processAction` ไม่มี `@Audit` decorator |
| R1 | Remaining | `recipients` DTO ไม่มี nested validation |
| R2 | Remaining | `PUT /:uuid` ใช้ permission `correspondence.create` แทน `correspondence.edit` |
| R3 | Remaining | ไม่มี Idempotency protection บน mutation endpoints |

### การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `correspondence.controller.ts` | เพิ่ม `import { ValidationException }` + แทน `throw new Error` ด้วย `throw new ValidationException` |
| `correspondence.controller.ts` | เพิ่ม `@Audit('correspondence.workflow_action', 'correspondence')` บน `processAction` |
| `correspondence.controller.ts` | แก้ `PUT /:uuid` → `@RequirePermission('correspondence.edit')` (permission id=73 มีใน seed แล้ว) |
| `correspondence.controller.ts` | เพิ่ม `@UseInterceptors(IdempotencyInterceptor)` ทุก 7 mutation endpoints |
| `correspondence.service.ts` | `bulkCancel` catch block เพิ่ม `this.logger.warn(...)` |
| `correspondence.service.ts` | `exportCsv` force `limit: 10000` override |
| `correspondence.service.ts` | `escapeCsv` เพิ่ม prefix `'` สำหรับ values เริ่มต้นด้วย `=`, `+`, `-`, `@`, `\t`, `\r` |
| `correspondence.service.ts` | `update()` re-index ใช้ `currentRevisionStatus` จาก `revisions.find(r => r.isCurrent)` แทน `'DRAFT'` |
| `dto/create-correspondence.dto.ts` | เพิ่ม `RecipientDto` class + `@ValidateNested({ each: true })` + `@Type(() => RecipientDto)` |

### กฎที่ Lock แล้ว

- CSV export ต้อง override `limit` ก่อน call `findAll` เสมอ (ห้ามใช้ pagination default)
- `escapeCsv` ต้องกัน OWASP formula injection (prefix `'` สำหรับ `=+−@\t\r`)
- Mutation endpoints ใน correspondence controller ต้องมี `@UseInterceptors(IdempotencyInterceptor)`
- `PUT /:uuid` ต้องใช้ `correspondence.edit` permission (ไม่ใช่ `correspondence.create`)

---

## Part 2: RFA Service ADR-001/021 Migration (User-driven)

### สิ่งที่ User เปลี่ยนแปลง

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `rfa.service.ts` | ลบ `CorrespondenceRouting`, `RoutingTemplate`, `RoutingTemplateStep` imports และ repos |
| `rfa.service.ts` | เพิ่ม `RfaMapped` interface fields: `workflowInstanceId`, `workflowState`, `availableActions` (ADR-021) |
| `rfa.service.ts` | เพิ่ม static constants: `WORKFLOW_CODE`, `STATE_TO_STATUS`, `DEFAULT_APPROVED_CODE` |
| `rfa.service.ts` | EC-RFA-001 check ย้ายเข้า transaction + `FOR UPDATE` lock (กัน TOCTOU race condition) |
| `rfa.service.ts` | `createInstance` ใช้ `RfaService.WORKFLOW_CODE` constant แทน hardcoded `'RFA_APPROVAL'` |
| `rfa.service.ts` | `findOneByUuid` ดึง workflow instance ผ่าน `getInstanceByEntity()` และ expose ADR-021 fields |
| `rfa.service.ts` | `submit()` ตัด `templateId` parameter ออก — rewire ผ่าน `workflowEngine.processTransition()` |
| `rfa.service.ts` | `processAction()` ตัด routing-template lookup ออก — ใช้ `workflowEngine.processTransition()` |
| `rfa.service.ts` | เพิ่ม `syncRevisionStatus()` helper: map workflow state → RFA status code + approve code |
| `rfa.service.ts` | เพิ่ม `notifyRecipients()` helper: ADR-008 async notify ผ่าน `notificationService.send()` |
| `rfa.module.ts` | ตัด deprecated routing-template entities ออกจาก `TypeOrmModule.forFeature([...])` |

### กฎที่ Lock แล้ว

- RFA ใช้ `workflowEngine.processTransition()` เป็น single entry point สำหรับ submit/approve/reject
- `syncRevisionStatus()` ต้องใช้ `STATE_TO_STATUS` map — ห้าม hardcode status code
- EC-RFA-001 ต้องทำใน transaction ด้วย `FOR UPDATE` lock (ไม่ใช่ก่อน transaction)
- Notification ต้องเรียกหลัง transaction commit แบบ `void ... .catch(...)` (ADR-008)

---

## Verification

- [ ] `pnpm --filter backend build` ผ่าน (ต้องตรวจสอบหลัง rfa.module.ts cleanup ครบ)
- [ ] `pnpm --filter backend exec tsc --noEmit` ไม่มี type error
- [ ] ทดสอบ `POST /correspondences` with `Idempotency-Key` header — duplicate request ต้องได้ cached response
- [ ] ทดสอบ CSV export มีมากกว่า 10 rows
- [ ] ทดสอบ `PUT /correspondences/:uuid` กับ user ที่มี `correspondence.edit` permission
- [ ] ทดสอบ `recipients` DTO validation กัน invalid `type` (ไม่ใช่ TO/CC)
