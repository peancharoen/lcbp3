# Error Catalog

**Version:** 1.0  
**ADR Compliance:** ADR-007 (Error Handling & Recovery Strategy)  
**Last Updated:** 2026-04-06

---

## Error Format (ADR-007)

All API errors follow this structure:

```json
{
  "error": {
    "type": "VALIDATION",
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่",
    "severity": "LOW",
    "timestamp": "2026-04-06T10:00:00.000Z",
    "statusCode": 400,
    "recoveryActions": ["ตรวจสอบข้อมูลที่กรอก", "ลองใหม่อีกครั้ง"]
  }
}
```

---

## Error Types

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION` | 400 | ข้อมูล Input ไม่ถูกต้อง |
| `BUSINESS_RULE` | 422 | ละเมิดกฎทางธุรกิจ |
| `PERMISSION_DENIED` | 403 | ไม่มีสิทธิ์ดำเนินการ |
| `NOT_FOUND` | 404 | ไม่พบข้อมูลที่ร้องขอ |
| `CONFLICT` | 409 | ข้อมูลซ้ำหรือขัดแย้ง |
| `INTERNAL_ERROR` | 500 | ปัญหาระบบภายใน |
| `DATABASE_ERROR` | 500 | ปัญหาฐานข้อมูล |
| `EXTERNAL_SERVICE` | 500 | บริการภายนอกมีปัญหา |
| `INFRASTRUCTURE` | 500 | ปัญหาโครงสร้างพื้นฐาน |

## Severity Levels

| Severity | Description | User Impact |
|----------|-------------|-------------|
| `LOW` | ผู้ใช้ทำผิด แก้ไขง่าย | แก้ไขข้อมูลได้ทันที |
| `MEDIUM` | ละเมิดกฎทางธุรกิจ | ต้องดำเนินการก่อน |
| `HIGH` | ปัญหาระบบ | อาจต้องติดต่อ Support |
| `CRITICAL` | ระบบล้มเหลว | ต้องแก้ไขทันที |

---

## Error Codes Reference

### General Errors

| Error Code | Type | HTTP | User Message | Severity | Module |
|------------|------|------|--------------|----------|--------|
| `VALIDATION_ERROR` | VALIDATION | 400 | ข้อมูลที่กรอกไม่ถูกต้อง | LOW | All |
| `NOT_FOUND` | NOT_FOUND | 404 | ไม่พบข้อมูลที่ร้องขอ | LOW | All |
| `PERMISSION_DENIED` | PERMISSION_DENIED | 403 | ไม่มีสิทธิ์ดำเนินการ | MEDIUM | All |
| `INTERNAL_ERROR` | INTERNAL_ERROR | 500 | เกิดข้อผิดพลาดในระบบ | HIGH | All |
| `DATABASE_ERROR` | DATABASE_ERROR | 500 | เกิดข้อผิดพลาดของฐานข้อมูล | HIGH | All |
| `NETWORK_ERROR` | INFRASTRUCTURE | N/A | ไม่สามารถเชื่อมต่อได้ | HIGH | Frontend |

### Correspondence Errors

| Error Code | Type | HTTP | User Message | Severity | Recovery Actions |
|------------|------|------|--------------|----------|-----------------|
| `INVALID_DOCUMENT_TYPE` | BUSINESS_RULE | 422 | การสื่อสารภายในควรใช้ Circulation Sheet | MEDIUM | ใช้ Circulation Sheet |
| `CORRESPONDENCE_TO_SELF` | BUSINESS_RULE | 422 | ไม่สามารถส่งถึงองค์กรตัวเองได้ | MEDIUM | ใช้ Circulation Sheet |
| `SELF_REFERENCE` | BUSINESS_RULE | 422 | ไม่สามารถอ้างอิงเอกสารเดียวกัน | MEDIUM | เลือกเอกสารอื่น |

### RFA Errors

| Error Code | Type | HTTP | User Message | Severity | Recovery Actions |
|------------|------|------|--------------|----------|-----------------|
| `RFA_TYPE_CONTRACT_MISMATCH` | BUSINESS_RULE | 422 | ประเภท RFA ไม่ตรงกับสัญญา | MEDIUM | เลือกประเภท RFA ที่ถูกต้อง |
| `DISCIPLINE_CONTRACT_MISMATCH` | BUSINESS_RULE | 422 | Discipline ไม่ตรงกับสัญญา | MEDIUM | เลือก Discipline ที่ถูกต้อง |
| `EC_RFA_001_ACTIVE_RFA_EXISTS` | BUSINESS_RULE | 422 | Shop Drawing มี RFA ที่ใช้งานอยู่แล้ว | MEDIUM | ตรวจสอบ RFA ที่มีอยู่ |
| `ROUTING_TEMPLATE_NOT_FOUND` | BUSINESS_RULE | 422 | ไม่พบ Routing Template | MEDIUM | ตรวจสอบ Template |
| `ROUTING_TEMPLATE_EMPTY` | BUSINESS_RULE | 422 | Routing Template ไม่มีขั้นตอน | MEDIUM | เพิ่ม Step ใน Template |
| `RFA_INVALID_SUBMIT_STATUS` | BUSINESS_RULE | 422 | ส่งได้เฉพาะ DRAFT เท่านั้น | MEDIUM | ตรวจสอบสถานะ |
| `RFA_EDIT_NON_DRAFT` | BUSINESS_RULE | 422 | แก้ไขได้เฉพาะ DRAFT เท่านั้น | MEDIUM | สร้าง Revision ใหม่ |
| `NO_ACTIVE_WORKFLOW_STEP` | BUSINESS_RULE | 422 | ไม่พบ Workflow Step ที่เปิดอยู่ | MEDIUM | ตรวจสอบสถานะ Workflow |

### Workflow Engine Errors

| Error Code | Type | HTTP | User Message | Severity | Recovery Actions |
|------------|------|------|--------------|----------|-----------------|
| `WORKFLOW_NOT_ACTIVE` | BUSINESS_RULE | 422 | Workflow ไม่อยู่ในสถานะ Active | MEDIUM | ตรวจสอบสถานะ Workflow |
| `WORKFLOW_NO_INITIAL_STATE` | BUSINESS_RULE | 422 | Workflow ไม่มี Initial State | MEDIUM | ตรวจสอบ DSL |
| `WORKFLOW_INVALID_CURRENT_STATE` | BUSINESS_RULE | 422 | Workflow อยู่ในสถานะที่ไม่รู้จัก | MEDIUM | ตรวจสอบ DSL |
| `WORKFLOW_TERMINAL_STATE` | BUSINESS_RULE | 422 | ไม่สามารถดำเนินการจาก State สุดท้าย | MEDIUM | เอกสารสิ้นสุดแล้ว |
| `WORKFLOW_INVALID_ACTION` | BUSINESS_RULE | 422 | ไม่สามารถดำเนินการนี้ในสถานะปัจจุบัน | MEDIUM | เลือกการดำเนินการที่อนุญาต |
| `WORKFLOW_ROLE_REQUIRED` | BUSINESS_RULE | 422 | ต้องมี Role ที่กำหนด | MEDIUM | ขอสิทธิ์จาก Admin |
| `WORKFLOW_USER_MISMATCH` | BUSINESS_RULE | 422 | ผู้ใช้ไม่ได้รับอนุญาต | MEDIUM | ตรวจสอบบัญชีที่ใช้ |
| `WORKFLOW_CONDITION_NOT_MET` | BUSINESS_RULE | 422 | เงื่อนไขสำหรับการดำเนินการไม่ผ่าน | MEDIUM | ตรวจสอบเงื่อนไข |
| `WORKFLOW_INVALID_RETURN_TARGET` | BUSINESS_RULE | 422 | ไม่สามารถส่งคืนไปเกินขั้นตอนแรก | MEDIUM | ตรวจสอบลำดับขั้นตอน |

### DSL Validation Errors

| Error Code | Type | HTTP | User Message | Severity | Recovery Actions |
|------------|------|------|--------------|----------|-----------------|
| `DSL_MULTIPLE_INITIAL_STATES` | BUSINESS_RULE | 422 | DSL มี Initial State หลายค่า | MEDIUM | แก้ไข DSL |
| `DSL_UNKNOWN_TRANSITION_TARGET` | BUSINESS_RULE | 422 | DSL อ้างอิง State ที่ไม่พบ | MEDIUM | ตรวจสอบชื่อ State |
| `DSL_NO_INITIAL_STATE` | BUSINESS_RULE | 422 | DSL ไม่มี Initial State | MEDIUM | เพิ่ม initial: true |
| `INVALID_WORKFLOW_DSL` | BUSINESS_RULE | 422 | Workflow DSL ไม่ถูกต้อง | MEDIUM | ตรวจสอบ syntax |

---

## Exception Classes Reference

| Class | Code | HTTP | Usage |
|-------|------|------|-------|
| `ValidationException` | `VALIDATION_ERROR` | 400 | Input validation failures |
| `BusinessException` | custom | 422 | Business rule violations |
| `NotFoundException` | `NOT_FOUND` | 404 | Resource not found |
| `PermissionException` | `PERMISSION_DENIED` | 403 | RBAC failures |
| `ConflictException` | custom | 409 | Duplicate/conflict |
| `WorkflowException` | custom | 422 | Workflow state/transition errors |
| `SystemException` | `INTERNAL_ERROR` | 500 | Infrastructure issues |
| `DatabaseException` | `DATABASE_ERROR` | 500 | DB failures |

---

## Developer Guidelines

### When to use each exception

```typescript
// ✅ Input validation (user made a mistake)
throw new ValidationException('User must belong to an organization');

// ✅ Resource not found
throw new NotFoundException('Correspondence', publicId);

// ✅ Business rule violation
throw new BusinessException(
  'EC_RFA_001_ACTIVE_RFA_EXISTS',
  'Technical message for logs',
  'Thai user message',
  ['Recovery action 1', 'Recovery action 2']
);

// ✅ Permission denied (RBAC)
throw new PermissionException('correspondence', 'cancel');

// ✅ Workflow state error
throw new WorkflowException(
  'WORKFLOW_INVALID_ACTION',
  'Technical message',
  'Thai user message',
  ['Recovery actions']
);

// ✅ Master data / config missing (internal system issue)
throw new SystemException('Status DRAFT not found in Master Data');
```

### Anti-patterns (Do NOT use)

```typescript
// ❌ Never use NestJS built-in exceptions in service layer
import { NotFoundException } from '@nestjs/common'; // WRONG

// ❌ Never use generic error messages
throw new SystemException('Error'); // Too vague

// ❌ Never expose technical details in user messages
throw new BusinessException(
  'DB_ERROR',
  'DB error',
  'SQL constraint error: ...' // Exposes internals
);
```

---

## Adding New Error Codes

1. Add entry to this catalog with full details
2. Add `code` constant if reused often (optional)
3. Use `BusinessException` or specific class
4. Provide Thai user message + recovery actions
5. Update test coverage

---

**Maintainers:** Backend Team Lead  
**Review Cycle:** Every 6 months (next: 2026-10-06)
