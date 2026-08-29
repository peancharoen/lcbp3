# API Contract: Workflow Transition

**Date**: 2026-08-28
**Related ADR**: [ADR-049](../../06-Decision-Records/ADR-049-workflow-state-machine-consolidation.md)

## POST /api/workflow/instances/:instanceId/transitions

เป็น endpoint หลักสำหรับทำ workflow transition — ใช้สำหรับทุก workflow type (RFA/Circulation/Correspondence/Transmittal)

### Request

```json
{
  "action": "APPROVE",
  "payload": {
    "approveCode": "1",
    "consentReasonCode": "NO_OBJECTION",
    "comment": "Approved per design review"
  },
  "impersonatedUserId": "019505a1-7c3e-7000-8000-abc123def456"
}
```

**Fields**:

- `action` (required): transition action จาก DSL (e.g., SUBMIT, APPROVE, CONSENT_FOR_APPROVE)
- `payload.approveCode` (optional): approve code 1/2/3/4 — Engine validate ว่าตรงกับ transition ใน DSL
- `payload.consentReasonCode` (optional): consent reason code — เก็บใน `rfa_consent_reasons` (metadata)
- `payload.comment` (optional): comment ของ transition
- `impersonatedUserId` (optional): UUID ของ user ที่ทำแทน — เฉพาะ Superadmin/Org Admin เท่านั้น

### Response 200

```json
{
  "publicId": "019505a1-7c3e-7000-8000-def456abc789",
  "workflowCode": "RFA_APPROVAL",
  "version": 2,
  "currentState": "APPROVED",
  "previousState": "OWNER_APPROVAL",
  "action": "APPROVE",
  "approveCode": "1",
  "statusProjection": {
    "rfa": "FCO"
  },
  "impersonated": false,
  "onBehalfOf": null,
  "onBehalfOfUserActive": null,
  "transitionedAt": "2026-08-28T10:00:00.000Z"
}
```

### Response 422 (Business Error)

```json
{
  "error": {
    "type": "BUSINESS_RULE",
    "code": "WORKFLOW_INVALID_ACTION",
    "message": "ไม่สามารถดำเนินการ \"APPROVE\" ในสถานะปัจจุบัน",
    "recoveryActions": ["เลือกการดำเนินการที่อนุญาตจากรายการ"]
  }
}
```

### Response 403 (RBAC Denied)

```json
{
  "error": {
    "type": "BUSINESS_RULE",
    "code": "WORKFLOW_ROLE_REQUIRED",
    "message": "ต้องมี Role: [OWNER] จึงจะดำเนินการนี้ได้",
    "recoveryActions": ["ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์"]
  }
}
```

## GET /api/workflow/instances/:instanceId

ดู workflow instance ปัจจุบัน + available actions

### Response 200

```json
{
  "publicId": "019505a1-7c3e-7000-8000-def456abc789",
  "workflowCode": "RFA_APPROVAL",
  "version": 2,
  "currentState": "OWNER_APPROVAL",
  "statusProjection": {
    "rfa": "FAP"
  },
  "availableActions": [
    {
      "action": "APPROVE",
      "label": "Approve",
      "requiredRole": "OWNER",
      "approveCode": "1"
    },
    {
      "action": "APPROVE_WITH_COMMENTS",
      "label": "Approve with Comments",
      "requiredRole": "OWNER",
      "approveCode": "2"
    },
    {
      "action": "RESUBMIT",
      "label": "Resubmit",
      "requiredRole": "OWNER",
      "approveCode": "3"
    },
    {
      "action": "REJECT",
      "label": "Reject",
      "requiredRole": "OWNER",
      "approveCode": "4"
    }
  ],
  "isTerminal": false
}
```

## GET /api/workflow/instances/:instanceId/histories

ดู transition history พร้อม impersonation metadata

### Response 200

```json
{
  "histories": [
    {
      "publicId": "019505a1-7c3e-7000-8000-hist001",
      "action": "APPROVE",
      "fromState": "OWNER_APPROVAL",
      "toState": "APPROVED",
      "actorUserPublicId": "019505a1-7c3e-7000-8000-admin001",
      "approveCode": "1",
      "impersonated": true,
      "onBehalfOfUserPublicId": "019505a1-7c3e-7000-8000-owner001",
      "onBehalfOfUserActive": false,
      "createdAt": "2026-08-28T10:00:00.000Z"
    }
  ]
}
```
