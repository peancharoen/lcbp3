# ADR-003: API Design Strategy

**Status:** ✅ Accepted (Implementation Ready)
**Date:** 2026-04-04
**Decision Makers:** Development Team, System Architect
**Related Documents:**

- [API Design & Error Handling](../02-Architecture/02-04-api-design.md)
- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md)
- [ADR-005: Technology Stack](./ADR-005-technology-stack.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:
- **API Design & Error Handling** - Section 2: "ระบบต้องใช้ RESTful Principles และมีความสอดคล้องกัน"
  - เหตุผล: ต้องการบันทึกการตัดสินใจเกี่ยวกับ API Design Patterns ที่ใช้จริงในระบบ
- **Backend Guidelines** - Section 3: "การออกแบบ API ต้องรองรับ TypeScript และ NestJS Patterns"
  - เหตุผล: ต้องการทำให้ API Design สอดคล้องกับ NestJS Ecosystem

### แก้ไขความขัดแย้ง:
- **REST Purity** vs **Pragmatic API Design**: ต้องการความสวยงามของ REST แต่ต้องรองรับ Business Logic ที่ซับซ้อน
  - การตัดสินใจนี้ช่วยแก้ไขโดย: ใช้ RESTful หลักแต่เพิ่ม Pragmatic Patterns สำหรับ Workflow และ Business Operations

---

## Context and Problem Statement

LCBP3-DMS ต้องการ API Design ที่:

1. **Consistent:** ทุก Endpoint ใช้ Patterns เดียวกัน
2. **Type-Safe:** รองรับ TypeScript และ DTO Validation
3. **Business-Ready:** รองรับ Workflow Operations และ Complex Business Logic
4. **Document-Driven:** Auto-generate Swagger Documentation
5. **Performance-Oriented:** รองรับ Pagination, Filtering, และ Caching

### Key Challenges

1. **Resource Naming:** การตั้งชื่อ Resources ที่สะท้อน Business Domain
2. **Complex Operations:** Workflow transitions, Document numbering ที่ไม่ใช่ CRUD ธรรมดา
3. **Response Consistency:** การคืนค่าที่สม่ำเสมอทั้ง Single และ Collection
4. **Error Handling:** การจัดการ Business Exceptions และ Validation Errors
5. **Versioning:** การเตรียมพร้อมสำหรับ API Evolution

---

## Decision Drivers

- **Developer Experience:** ง่ายต่อการใช้งานและ Debug
- **Type Safety:** ป้องกัน Runtime Errors ด้วย TypeScript
- **Business Alignment:** API สะท้อน Business Processes จริง
- **Performance:** รองรับ High-volume Operations
- **Documentation:** Auto-generated และ Up-to-date
- **Testing:** ง่ายต่อการ Unit Test และ Integration Test

---

## Considered Options

### Option 1: Pure REST with Resource Endpoints Only

**แนวทาง:** ใช้ REST Resources เท่านั้น ไม่มี Action Endpoints

**Pros:**

- ✅ RESTful purity
- ✅ Simple to understand
- ✅ Standard HTTP semantics

**Cons:**

- ❌ Difficult for complex business operations
- ❌ Workflow transitions become awkward
- ❌ Document numbering doesn't fit resource model

### Option 2: RPC-style with Action Endpoints

**แนวทาง:** ใช้ Action Endpoints สำหรับทุก Business Operation

**Pros:**

- ✅ Clear business intent
- ✅ Easy for complex operations
- ✅ Direct mapping to use cases

**Cons:**

- ❌ Not RESTful
- ❌ Inconsistent patterns
- ❌ Hard to document with Swagger

### Option 3: **Hybrid REST + Action Endpoints** ⭐ (Selected)

**แนวทาง:** REST สำหรับ CRUD และ Action Endpoints สำหรับ Business Operations

**Pros:**

- ✅ **Best of Both Worlds:** REST ที่เหมาะสม + Actions ที่ชัดเจน
- ✅ **Business Clarity:** Workflow actions อยู่ใน endpoints ที่เข้าใจง่าย
- ✅ **Type Safety:** DTOs สำหรับทุก operation
- ✅ **Documentation:** Swagger สามารถ document ได้ทั้งสองแบบ
- ✅ **Consistency:** Clear naming conventions

**Cons:**

- ❌ Slightly more complex
- ❌ Requires developer discipline

---

## Decision Outcome

**Chosen Option:** Option 3 - Hybrid REST + Action Endpoints

### Rationale

เลือก Hybrid Approach เนื่องจาก:

1. **Business Reality:** DMS มี Operations ที่ซับซ้อน (Workflow, Numbering) ที่ไม่ fit กับ pure REST
2. **Developer Experience:** Actions ชัดเจนกว่าการยัด business logic ลงใน PATCH
3. **Maintainability:** แยก concerns ระหว่าง data access และ business operations
4. **Scalability:** สามารถเพิ่ม business operations ได้โดยไม่ทำให้ REST resources ซับซ้อน

---

## 🔍 Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ)

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **API Controllers** | 🔴 High | ต้องใช้ Hybrid Pattern สำหรับทุก Module | Refactor controllers |
| **DTOs** | 🔴 High | ต้องสร้าง DTOs สำหรับทุก Endpoint | Create comprehensive DTOs |
| **Documentation** | 🟡 Medium | Swagger ต้อง cover ทั้ง REST และ Actions | Update Swagger config |
| **Frontend API Client** | 🟡 Medium | ต้องรองรับทั้งสอง pattern | Update API service calls |
| **Testing** | 🟡 Medium | ต้อง test ทั้ง resource และ action endpoints | Add integration tests |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ)

#### 🔴 Critical Changes (ต้องทำทันที)
- [x] **Define API Standards** - สร้างมาตรฐานการตั้งชื่อและ patterns
- [ ] **Refactor Correspondence API** - ใช้ hybrid pattern
- [ ] **Update RFA API** - ใช้ action endpoints สำหรับ workflow
- [ ] **Create Base Controller** - shared patterns และ utilities

#### 🟡 Important Changes (ควรทำภายใน 1 สัปดาห์)
- [ ] **Update API Documentation** - Swagger พร้อม examples
- [ ] **Create API Client Library** - frontend TypeScript client
- [ ] **Add Integration Tests** - test ทุก endpoint patterns
- [ ] **Performance Testing** - ตรวจสอบ response times

#### 🟢 Nice-to-Have (ทำถ้ามีเวลา)
- [ ] **API Versioning Strategy** - prepare for v2
- [ ] **OpenAPI Generator** - auto-generate clients
- [ ] **API Analytics** - track usage patterns

---

## Implementation Details

### API Design Patterns

#### 1. Resource Endpoints (REST)

```typescript
// Standard CRUD operations
GET    /api/v1/correspondences           // List with pagination
GET    /api/v1/correspondences/:id       // Get by UUID
POST   /api/v1/correspondences           // Create
PUT    /api/v1/correspondences/:id       // Full update
PATCH  /api/v1/correspondences/:id       // Partial update
DELETE /api/v1/correspondences/:id       // Soft delete
```

#### 2. Action Endpoints (Business Operations)

```typescript
// Workflow actions
POST /api/v1/correspondences/:id/submit
POST /api/v1/correspondences/:id/approve
POST /api/v1/correspondences/:id/reject
POST /api/v1/correspondences/:id/forward

// Document numbering
POST /api/v1/document-numbering/reserve
POST /api/v1/document-numbering/generate

// Bulk operations
POST /api/v1/correspondences/bulk-update
POST /api/v1/correspondences/bulk-approve

// Reports and exports
GET /api/v1/reports/correspondence-summary
GET /api/v1/exports/correspondences/:format
```

### Response Format Standards

#### Success Response (Single Resource)

```typescript
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000", // UUID (ADR-019)
    "documentNumber": "LCBP3-CORR-2024-0001",
    "subject": "Meeting minutes",
    "status": "SUBMITTED",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}
```

#### Success Response (Collection)

```typescript
{
  "data": [
    { "id": "...", "documentNumber": "...", ... },
    { "id": "...", "documentNumber": "...", ... }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    },
    "filters": {
      "status": "SUBMITTED",
      "dateFrom": "2024-01-01"
    },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Action Response

```typescript
{
  "data": {
    "action": "approve",
    "result": "SUCCESS",
    "nextStatus": "APPROVED",
    "workflow": {
      "id": "wf-123",
      "currentState": "APPROVED",
      "previousState": "PENDING_APPROVAL"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "processedBy": "user-456"
  }
}
```

### Error Response Format

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed on input data",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00Z",
    "path": "/api/v1/correspondences",
    "details": [
      {
        "field": "subject",
        "message": "Subject is required and must be at least 10 characters",
        "value": null
      }
    ]
  }
}
```

### Naming Conventions

#### URL Paths

- **Resources:** Plural nouns, kebab-case
  - `/correspondences`, `/projects`, `/organizations`
- **Actions:** Verb-noun pattern, kebab-case
  - `/correspondences/:id/submit`, `/document-numbering/generate`
- **Nested Resources:** Parent-child relationship
  - `/projects/:id/contracts`, `/contracts/:id/correspondences`

#### JSON Properties

- **Properties:** camelCase
  - `documentNumber`, `createdAt`, `primaryOrganizationId`
- **Enums:** UPPER_SNAKE_CASE
  - `"SUBMITTED"`, `"IN_REVIEW"`, `"APPROVED"`
- **Booleans:** is/has prefix
  - `isActive`, `hasAttachments`, `canEdit`

### DTO Examples

#### Create DTO

```typescript
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateCorrespondenceDto {
  @IsString()
  @MinLength(10)
  subject: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsEnum(['LETTER', 'RFI', 'MEMO', 'NOTICE'])
  type: CorrespondenceType;

  @IsUUID()
  @IsOptional()
  originatorId?: string;

  @IsUUID()
  projectId: string;

  @IsArray()
  @IsUUID(4, { each: true })
  recipientIds: string[];
}
```

#### Action DTO

```typescript
export class ApproveCorrespondenceDto {
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
```

---

## Consequences

### Positive

1. ✅ **Business Clarity:** Actions สะท้อน business operations ชัดเจน
2. ✅ **Type Safety:** DTOs ป้องกัน runtime errors
3. ✅ **Consistency:** Standard patterns ทั่วทั้ง API
4. ✅ **Documentation:** Auto-generated Swagger ครบถ้วน
5. ✅ **Maintainability:** แยก concerns ระหว่าง data และ business logic
6. ✅ **Testing:** ง่ายต่อการ test ทุก endpoint

### Negative

1. ❌ **Learning Curve:** ต้องเรียนรู้ hybrid patterns
2. ❌ **Documentation Complexity:** ต้องอธิบายทั้ง REST และ Actions
3. ❌ **API Surface Area:** มี endpoints มากขึ้น

### Mitigation Strategies

- **Learning Curve:** Create comprehensive API guidelines and examples
- **Documentation:** Use Swagger groups and descriptions
- **API Surface:** Group related endpoints และใช้ consistent patterns

---

## 🔄 Review Cycle & Maintenance

### Review Schedule
- **Next Review:** 2026-10-04 (6 months from creation)
- **Review Type:** Scheduled (API Strategy Review)
- **Reviewers:** System Architect, Backend Team Lead, Frontend Team Lead

### Review Checklist
- [ ] ยังคงตอบโจทย์ Business Requirements หรือไม่?
- [ ] มี API patterns ใหม่ที่ควรพิจารณาหรือไม่?
- [ ] มีปัญหา Performance หรือ Usability หรือไม่?
- [ ] ต้องการ Update หรือ Deprecate patterns ใดหรือไม่?

### Version History
| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2026-04-04 | Initial version - Hybrid REST + Action Strategy | ✅ Accepted |

---

## Compliance

เป็นไปตาม:

- [API Design & Error Handling](../02-Architecture/02-04-api-design.md)
- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md) - NestJS framework choice
- [ADR-010: Logging & Monitoring](./ADR-010-logging-monitoring-strategy.md) - API request logging
- [ADR-016: Security Authentication](./ADR-016-security-authentication.md) - API security

---

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [REST API Design Best Practices](https://restfulapi.net/)
