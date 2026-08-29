# API Contract: RFA Action

**Date**: 2026-08-28
**Related ADR**: [ADR-049](../../06-Decision-Records/ADR-049-workflow-state-machine-consolidation.md)

## POST /api/rfa/:rfaPublicId/revisions/:revisionPublicId/actions

RFA-specific endpoint สำหรับทำ action ใน RFA workflow — wrapper ของ workflow transition ที่เชื่อม RFA revision กับ workflow instance

### Request

```json
{
  "action": "CONSENT_FOR_APPROVE",
  "consentReasonCode": "NO_OBJECTION",
  "comment": "No objection to design",
  "impersonatedUserId": null
}
```

**Action vocabulary** (ตาม state):

| State | Action | Required Role | Approve Code |
|-------|--------|---------------|--------------|
| DRAFT | SUBMIT | Editor | — |
| CONSULTANT_REVIEW | CONSENT_FOR_APPROVE | CONSULTANT | — |
| CONSULTANT_REVIEW | ASK_DESIGNER | CONSULTANT | — |
| CONSULTANT_REVIEW | RESUBMIT | CONSULTANT | 3 |
| CONSULTANT_REVIEW | REJECT | CONSULTANT | 4 |
| DESIGNER_REVIEW | AGREED | DESIGNER | — |
| DESIGNER_REVIEW | AGREED_WITH_COMMENTS | DESIGNER | — |
| DESIGNER_REVIEW | NO_OBJECTION | DESIGNER | — |
| DESIGNER_REVIEW | OBJECTED | DESIGNER | — |
| OWNER_APPROVAL | APPROVE | OWNER | 1 |
| OWNER_APPROVAL | APPROVE_WITH_COMMENTS | OWNER | 2 |
| OWNER_APPROVAL | RESUBMIT | OWNER | 3 |
| OWNER_APPROVAL | REJECT | OWNER | 4 |

### Response 200

```json
{
  "rfaPublicId": "019505a1-7c3e-7000-8000-rfa001",
  "revisionPublicId": "019505a1-7c3e-7000-8000-rev001",
  "revisionNumber": 1,
  "workflowInstancePublicId": "019505a1-7c3e-7000-8000-wfi001",
  "currentState": "OWNER_APPROVAL",
  "previousState": "CONSULTANT_REVIEW",
  "action": "CONSENT_FOR_APPROVE",
  "rfaStatus": "FAP",
  "approveCode": null,
  "consentReasonCode": "NO_OBJECTION",
  "impersonated": false,
  "onBehalfOf": null,
  "transitionedAt": "2026-08-28T10:00:00.000Z"
}
```

## POST /api/rfa/:rfaPublicId/revisions

สร้าง RFA revision ใหม่ (หลัง REVISE_REQUIRED)

### Request

```json
{
  "description": "Revised per consultant comments",
  "attachments": ["019505a1-7c3e-7000-8000-att001"]
}
```

### Response 201

```json
{
  "rfaPublicId": "019505a1-7c3e-7000-8000-rfa001",
  "revisionPublicId": "019505a1-7c3e-7000-8000-rev002",
  "revisionNumber": 2,
  "workflowInstancePublicId": "019505a1-7c3e-7000-8000-wfi002",
  "currentState": "DRAFT",
  "rfaStatus": "DFT",
  "previousRevisionPublicId": "019505a1-7c3e-7000-8000-rev001",
  "previousWorkflowInstancePublicId": "019505a1-7c3e-7000-8000-wfi001",
  "previousInstanceTerminalState": "REVISE_REQUIRED"
}
```

## GET /api/rfa/:rfaPublicId/revisions/:revisionPublicId/available-actions

ดู action ที่ใช้ได้ใน state ปัจจุบัน

### Response 200

```json
{
  "currentState": "CONSULTANT_REVIEW",
  "availableActions": [
    {
      "action": "CONSENT_FOR_APPROVE",
      "label": "Consent for Approve",
      "requiredRole": "CONSULTANT",
      "requiresConsentReason": true
    },
    {
      "action": "ASK_DESIGNER",
      "label": "Ask Designer",
      "requiredRole": "CONSULTANT",
      "requiresConsentReason": false
    },
    {
      "action": "RESUBMIT",
      "label": "Resubmit",
      "requiredRole": "CONSULTANT",
      "approveCode": "3"
    },
    {
      "action": "REJECT",
      "label": "Reject",
      "requiredRole": "CONSULTANT",
      "approveCode": "4"
    }
  ]
}
```
