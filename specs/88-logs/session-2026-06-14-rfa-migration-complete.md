# Session — 2026-06-14 (RFA ADR-001/021 Migration — Complete)

## Summary

ทำ RFA Workflow Migration ให้เสร็จครบ — ตัด `templateId` ออกจาก DTO ทั้ง frontend/backend,
ลบ deprecated routing-template entities + `RfaWorkflowService` ออกจาก `rfa.module.ts`,
เพิ่ม static constants ที่หายไปใน `RfaService`, และอัปเดต tests ให้ align กับ contract ใหม่
ผลลัพธ์: `tsc --noEmit` exit 0 + 26/26 frontend tests pass

## ปัญหาที่พบ (Root Cause)

- `rfa.service.ts` อ้างอิง `RfaService.WORKFLOW_CODE`, `RfaService.STATE_TO_STATUS`, `RfaService.DEFAULT_APPROVED_CODE` แต่ไม่มีการ declare static constants เหล่านี้ในคลาส → TS2339 compile error
- `SubmitRfaDto` (backend + frontend) ยังมี `templateId` ซึ่งถูกตัดออกจาก service signature แล้ว
- `rfa.module.ts` ยังนำเข้า deprecated entities: `RfaWorkflow`, `RfaWorkflowTemplate`, `RfaWorkflowTemplateStep`, `CorrespondenceRouting`, `RoutingTemplate`, `RoutingTemplateStep` และ `RfaWorkflowService`
- `detail.tsx` ยังมี `templateId` state + "Routing Template ID" input + `Label` ที่ไม่จำเป็น
- Test files ยังอ้างอิง `templateId: 1` ใน submit DTO และ `'Routing Template ID'` assertion

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `backend/src/modules/rfa/dto/submit-rfa.dto.ts` | ตัด `templateId` field + `@IsInt` + `@IsNotEmpty` ออก; เหลือแค่ `reviewTeamPublicId?` |
| `backend/src/modules/rfa/rfa.module.ts` | ลบ `RfaWorkflow`, `RfaWorkflowTemplate`, `RfaWorkflowTemplateStep`, `CorrespondenceRouting`, `RoutingTemplate`, `RoutingTemplateStep` ออกจาก imports/forFeature; ลบ `RfaWorkflowService` จาก providers |
| `backend/src/modules/rfa/rfa.service.ts` | เพิ่ม static readonly constants: `WORKFLOW_CODE = 'RFA_APPROVAL'`, `STATE_TO_STATUS` (Record), `DEFAULT_APPROVED_CODE = '1A'` |
| `frontend/lib/services/rfa.service.ts` | ตัด `templateId: number` ออกจาก `SubmitRfaDto` interface |
| `frontend/components/rfas/detail.tsx` | ตัด `templateId` state + setter + "Routing Template ID" `<input>` block ออก; `handleSubmit()` ส่งแค่ `{ reviewTeamPublicId }` |
| `frontend/lib/services/__tests__/rfa.service.test.ts` | อัปเดต submit test DTO: `{ reviewTeamPublicId: 'uuid-team' }` (ไม่มี `templateId`) |
| `frontend/components/rfas/__tests__/detail.test.tsx` | ลบ `expect(screen.getByText('Routing Template ID')).toBeInTheDocument()` |

## กฎที่ Lock แล้ว

- **RFA submit contract:** `POST /rfas/:uuid/submit` รับเฉพาะ `{ reviewTeamPublicId?: string }` — ไม่มี `templateId`
- **Workflow Code:** `RFA_APPROVAL` (static constant ในคลาส ห้าม hardcode ในแต่ละ method)
- **STATE_TO_STATUS map:** `DRAFT→DFT`, `CONSULTANT_REVIEW→FRE`, `OWNER_REVIEW→FAP`, `APPROVED→FCO`
- **DEFAULT_APPROVED_CODE:** `'1A'` (fallback เมื่อ payload ไม่มี approveCode)

## Verification

- [x] `npx tsc --noEmit` (backend) → exit 0, no type errors
- [x] `npx vitest run lib/services/__tests__/rfa.service.test.ts components/rfas/__tests__/detail.test.tsx` → 26/26 passed
