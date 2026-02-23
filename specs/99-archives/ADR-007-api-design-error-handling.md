# ADR-007: API Design & Error Handling Strategy

**Status:** ✅ Accepted
**Date:** 2025-12-01
**Decision Makers:** Backend Team, System Architect
**Related Documents:** [Backend Guidelines](../03-implementation/03-02-backend-guidelines.md), [ADR-005: Technology Stack](./ADR-005-technology-stack.md)

---

## Context and Problem Statement

ระบบ LCBP3-DMS ต้องการมาตรฐานการออกแบบ API ที่ชัดเจนและสม่ำเสมอทั้งระบบ รวมถึงกลยุทธ์การจัดการ Error และ Validation ที่เหมาะสม

### ปัญหาที่ต้องแก้:

1. **API Consistency:** ทำอย่างไรให้ API response format สม่ำเสมอทั้งระบบ
2. **Error Handling:** จัดการ error อย่างไรให้ client เข้าใจและแก้ไขได้
3. **Validation:** Validate request อย่างไรให้ครอบคลุมและให้ feedback ที่ดี
4. **Status Codes:** ใช้ HTTP status codes อย่างไรให้ถูกต้องและสม่ำเสมอ

---

## Decision Drivers

- 🎯 **Developer Experience:** Frontend developers ต้องใช้ API ได้ง่าย
- 🔒 **Security:** ป้องกัน Information Leakage จาก Error messages
- 📊 **Debuggability:** ต้องหา Root cause ของ Error ได้ง่าย
- 🌍 **Internationalization:** รองรับภาษาไทยและอังกฤษ
- 📝 **Standards Compliance:** ใช้มาตรฐานที่เป็นที่ยอมรับ (REST, JSON:API)

---

## Considered Options

### Option 1: Standard REST with Custom Error Format

**รูปแบบ:**

```typescript
// Success
{
  "data": { ... },
  "meta": { "timestamp": "..." }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [...]
  }
}
```

**Pros:**

- ✅ Simple และเข้าใจง่าย
- ✅ Flexible สำหรับ Custom needs
- ✅ ไม่ต้อง Follow spec ที่ซับซ้อน

**Cons:**

- ❌ ไม่มี Standard specification
- ❌ ต้องสื่อสารภายในทีมให้ชัดเจน
- ❌ อาจไม่สม่ำเสมอหากไม่ระวัง

### Option 2: JSON:API Specification

**รูปแบบ:**

```typescript
{
  "data": {
    "type": "correspondences",
    "id": "1",
    "attributes": { ... },
    "relationships": { ... }
  },
  "included": [...]
}
```

**Pros:**

- ✅ มาตรฐานที่เป็นที่ยอมรับ
- ✅ มี Libraries ช่วย
- ✅ รองรับ Relationships ได้ดี

**Cons:**

- ❌ ซับซ้อนเกินความจำเป็น
- ❌ Verbose (ข้อมูลซ้ำซ้อน)
- ❌ Learning curve สูง

### Option 3: GraphQL

**Pros:**

- ✅ Client เลือกข้อมูลที่ต้องการได้
- ✅ ลด Over-fetching/Under-fetching
- ✅ Strong typing

**Cons:**

- ❌ Complexity สูง
- ❌ Caching ยาก
- ❌ ไม่เหมาะกับ Document-heavy system
- ❌ Team ยังไม่มีประสบการณ์

---

## Decision Outcome

**Chosen Option:** **Option 1 - Standard REST with Custom Error Format + NestJS Exception Filters**

### Rationale

1. **Simplicity:** ทีมคุ้นเคยกับ REST API และ NestJS มี Built-in support ที่ดี
2. **Flexibility:** สามารถปรับแต่งตาม Business needs ได้ง่าย
3. **Performance:** Lightweight กว่า JSON:API และ GraphQL
4. **Team Capability:** ทีมมีประสบการณ์ REST มากกว่า GraphQL

---

## Implementation Details

### 1. Success Response Format

```typescript
// Single resource
{
  "data": {
    "id": 1,
    "document_number": "CORR-2024-0001",
    "subject": "...",
    ...
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}

// Collection with pagination
{
  "data": [
    { "id": 1, ... },
    { "id": 2, ... }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 2. Error Response Format

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed on input data",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00Z",
    "path": "/api/correspondences",
    "details": [
      {
        "field": "subject",
        "message": "Subject is required",
        "value": null
      }
    ]
  }
}
```

### 3. HTTP Status Codes

| Status                    | Use Case                                    |
| ------------------------- | ------------------------------------------- |
| 200 OK                    | Successful GET, PUT, PATCH                  |
| 201 Created               | Successful POST                             |
| 204 No Content            | Successful DELETE                           |
| 400 Bad Request           | Validation error, Invalid input             |
| 401 Unauthorized          | Missing or invalid JWT token                |
| 403 Forbidden             | Insufficient permissions (RBAC)             |
| 404 Not Found             | Resource not found                          |
| 409 Conflict              | Duplicate resource, Business rule violation |
| 422 Unprocessable Entity  | Business logic error                        |
| 429 Too Many Requests     | Rate limit exceeded                         |
| 500 Internal Server Error | Unexpected server error                     |

### 4. Global Exception Filter

```typescript
// File: backend/src/common/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        code = (exceptionResponse as any).error || exception.name;
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details;
      } else {
        message = exceptionResponse;
      }
    }

    // Log error (but don't expose internal details to client)
    console.error('Exception:', exception);

    response.status(status).json({
      error: {
        code,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(details && { details }),
      },
    });
  }
}
```

### 5. Custom Business Exception

```typescript
// File: backend/src/common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(message: string, code: string = 'BUSINESS_ERROR') {
    super(
      {
        error: code,
        message,
      },
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}

// Usage
throw new BusinessException(
  'Cannot approve correspondence in current status',
  'INVALID_WORKFLOW_TRANSITION'
);
```

### 6. Validation Pipe Configuration

```typescript
// File: backend/src/main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw error if unknown properties
    transform: true, // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => {
      const details = errors.map((error) => ({
        field: error.property,
        message: Object.values(error.constraints || {}).join(', '),
        value: error.value,
      }));

      return new HttpException(
        {
          error: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
        HttpStatus.BAD_REQUEST
      );
    },
  })
);
```

---

## Consequences

### Positive Consequences

1. ✅ **Consistency:** API responses มีรูปแบบสม่ำเสมอทั้งระบบ
2. ✅ **Developer Friendly:** Frontend developers ใช้งาน API ได้ง่าย
3. ✅ **Debuggability:** Error messages ให้ข้อมูลเพียงพอสำหรับ Debug
4. ✅ **Security:** ไม่เปิดเผย Internal error details ให้ Client
5. ✅ **Maintainability:** ใช้ NestJS built-in features ทำให้ Maintain ง่าย

### Negative Consequences

1. ❌ **No Standard Spec:** ไม่ใช่ Standard เช่น JSON:API จึงต้องเขียน Documentation ชัดเจน
2. ❌ **Manual Documentation:** ต้อง Document API response format เอง
3. ❌ **Learning Curve:** Team members ใหม่ต้องเรียนรู้ Error code conventions

### Mitigation Strategies

- **Documentation:** ใช้ Swagger/OpenAPI เพื่อ Auto-generate API docs
- **Code Generation:** Generate TypeScript interfaces สำหรับ Frontend จาก DTOs
- **Error Code Registry:** มี Centralized list ของ Error codes พร้อมคำอธิบาย
- **Testing:** เขียน Integration tests เพื่อ Validate response formats

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md) - เลือกใช้ NestJS
- [ADR-004: RBAC Implementation](./ADR-004-rbac-implementation.md) - Error 403 Forbidden

---

## References

- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [HTTP Status Codes](https://httpstatuses.com/)
- [REST API Best Practices](https://restfulapi.net/)

---

**Last Updated:** 2025-12-01
**Next Review:** 2025-06-01
