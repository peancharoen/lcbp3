# 02.4 API Design & Error Handling (การออกแบบ API และการจัดการข้อผิดพลาด)

---

**title:** 'API Design & Error Handling'
**version:** 1.8.0
**status:** active
**owner:** Nattanin Peancharoen
**last_updated:** 2026-02-23
**related:**
  - specs/02-Architecture/00-01-system-context.md
  - specs/02-Architecture/02-03-software-architecture.md
  - specs/03-Implementation/03-01-fullstack-js-v1.7.0.md

---

## 1. 📋 ภาพรวม (Overview)

เอกสารนี้กำหนดมาตรฐานการออกแบบ API สำหรับระบบ LCBP3-DMS โดยใช้แนวทาง **API-First Design** ที่เน้นความชัดเจน ความสอดคล้อง และความปลอดภัย รวมถึงกลยุทธ์การจัดการ Error (Error Handling) สำหรับ Backend (NestJS)

## 2. 🎯 หลักการออกแบบ API (API Design Principles)

### 2.1 API-First Approach
- **ออกแบบ API ก่อนการ Implement:** ทำการออกแบบ API Endpoint และ Data Contract ให้ชัดเจนก่อนเริ่มเขียนโค้ด
- **Documentation-Driven:** ใช้ OpenAPI/Swagger เป็นเอกสารอ้างอิงหลัก
- **Contract Testing:** ทดสอบ API ตาม Contract ที่กำหนดไว้

### 2.2 RESTful Principles
- ใช้ HTTP Methods อย่างถูกต้อง: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- ใช้ HTTP Status Codes ที่เหมาะสม
- Resource-Based URL Design
- Stateless Communication

### 2.3 Consistency & Predictability
- **Naming Conventions:** ใช้ `kebab-case` สำหรับ URL paths
- **Property Naming:** ใช้ `camelCase` สำหรับ JSON properties และ query parameters (สอดคล้องกับ TypeScript/JavaScript conventions)
- **Database Columns:** Database ใช้ `snake_case` (mapped via TypeORM decorators)
- **Versioning:** รองรับการ Version API ผ่าน URL path (`/api/v1/...`)

## 3. 🔐 Authentication & Authorization

### 3.1 Authentication
- **JWT-Based Authentication:** ใช้ JSON Web Token สำหรับการยืนยันตัวตน
- **Token Management:**
  - Access Token Expiration: 8 ชั่วโมง
  - Refresh Token Expiration: 7 วัน
  - Token Rotation: รองรับการหมุนเวียน Refresh Token
  - Token Revocation: บันทึก Revoked Tokens จนกว่าจะหมดอายุ

**Endpoints คอร์:**
```typescript
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/change-password
```

### 3.2 Authorization (RBAC) (CASL)
ใช้ระบบ 4-Level Permission Hierarchy (Global, Organization, Project, Contract)
- **Permission Checking:** ใช้ Decorator `@RequirePermission('resource.action')`

**Example:**
```typescript
@RequirePermission('correspondence.create')
@Post('correspondences')
async createCorrespondence(@Body() dto: CreateCorrespondenceDto) {
  // Implementation
}
```

### 3.3 Token Payload Optimization
- JWT Payload เก็บเฉพาะ `userId` และ `scope` ปัจจุบัน
- **Permissions Caching:** เก็บ Permission List ใน Redis และดึงมาตรวจสอบเมื่อมี Request

## 4. 📡 API Conventions

### 4.1 Base URL Structure
```
https://backend.np-dms.work/api/v1/{resource}
```

### 4.2 HTTP Methods & Usage
| Method   | Usage                        | Idempotent | Example                              |
| :------- | :--------------------------- | :--------- | :----------------------------------- |
| `GET`    | ดึงข้อมูล (Read)                | ✅ Yes      | `GET /api/v1/correspondences`        |
| `POST`   | สร้างข้อมูลใหม่ (Create)         | ❌ No\*     | `POST /api/v1/correspondences`       |
| `PUT`    | อัปเดตทั้งหมด (Full Update)     | ✅ Yes      | `PUT /api/v1/correspondences/:id`    |
| `PATCH`  | อัปเดตบางส่วน (Partial Update) | ✅ Yes      | `PATCH /api/v1/correspondences/:id`  |
| `DELETE` | ลบข้อมูล (Soft Delete)         | ✅ Yes      | `DELETE /api/v1/correspondences/:id` |

* **Note:** `POST` เป็น Idempotent ได้เมื่อใช้ `Idempotency-Key` Header

### 4.3 Request Format
**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token>
Idempotency-Key: <uuid> # สำหรับ POST/PUT/DELETE
```

### 4.4 HTTP Status Codes
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

## 5. 🔄 Response Formats (Standard REST with Meta Data)

เราใช้ Standard REST with Custom Error Format ซึ่งเรียบง่ายและยืดหยุ่นกว่า

### 5.1 Success Response

**Single Resource:**
```typescript
{
  "data": {
    "id": 1,
    "document_number": "CORR-2024-0001",
    "subject": "...",
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}
```

**Collection (Pagination):**
```typescript
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

### 5.2 Error Response Format
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

## 6. 🛠️ NestJS Implementation Details

### 6.1 Global Exception Filter
คลาสจัดการ Error หลักที่จะจับและดัดแปลง Error ส่งคืน Client อย่างสม่ำเสมอ

```typescript
// File: backend/src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

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

### 6.2 Custom Business Exception
สำหรับจัดการข้อผิดพลาดเชิงความสัมพันธ์ หรือเงื่อนไขธุรกิจ เช่น State Conflict.

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

// Usage Example:
throw new BusinessException(
  'Cannot approve correspondence in current status',
  'INVALID_WORKFLOW_TRANSITION'
);
```

### 6.3 Validation Pipe Configuration
บังคับ Validation Pipe ก่อนส่งพารามิเตอร์ให้กับ Controller

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

## 7. 🛡️ API Security & Rate Limiting

### 7.1 Rate Limiting (Redis-backed)

| Endpoint Type       | Limit              | Scope |
| :------------------ | :----------------- | :---- |
| Anonymous Endpoints | 100 requests/hour  | IP    |
| Viewer              | 500 requests/hour  | User  |
| Editor              | 1000 requests/hour | User  |
| Document Control    | 2000 requests/hour | User  |
| Admin/Superadmin    | 5000 requests/hour | User  |
| File Upload         | 50 requests/hour   | User  |
| Search              | 500 requests/hour  | User  |
| Authentication      | 10 requests/minute | IP    |

### 7.2 File Upload Security
- **Virus Scanning:** ใช้ ClamAV scan ทุกไฟล์
- **File Type Validation:** White-list (PDF, DWG, DOCX, XLSX, ZIP)
- **File Size Limit:** 50MB per file
- **Two-Phase Storage:**
  1. Upload to `temp/` folder
  2. Commit to `permanent/{YYYY}/{MM}/` when operation succeeds

## 8. 🔄 Idempotency

- **ทุก Critical Operation** (Create, Update, Delete) ต้องรองรับ Idempotency
- Client ส่ง Header: `Idempotency-Key: <uuid>`
- Server เช็คว่า Key นี้เคยประมวลผลสำเร็จแล้วหรือไม่
- ถ้าเคยทำแล้ว: ส่งผลลัพธ์เดิมกลับไป (ไม่ทำซ้ำ)

## 9. 📈 Optimization & Additional Guidelines

### 9.1 Caching Strategy
- Master Data: 1 hour
- User Sessions: 30 minutes
- Search Results: 15 minutes
- File Metadata: 1 hour

### 9.2 API Versioning
- **URL-Based Versioning:** `/api/v1/...`, `/api/v2/...`
- **Backward Compatibility:** รองรับ API เวอร์ชันเก่าอย่างน้อย 1 เวอร์ชัน
- ใช้ Deprecation Headers เมื่อมีการยกเลิก Endpoints

### 9.3 Documentation
- **Swagger/OpenAPI:** Auto-generated จาก NestJS Decorators
- **URL:** `https://backend.np-dms.work/api/docs`

## 🎯 สรุป Best Practices
1. **ใช้ DTOs สำหรับ Validation ทุก Request**
2. **ส่ง Idempotency-Key สำหรับ Critical Operations**
3. **ใช้ Proper HTTP Status Codes**
4. **Implement Rate Limiting บน Client Side**
5. **Handle Errors Gracefully และอย่าเปิดเผยข้อผิดพลาดภายใน (DB Errors) สู่ Client**
6. **Cache Frequently-Accessed Data**
7. **Use Pagination สำหรับ Large Datasets เสมอ**
8. **Document ทุก Endpoint ด้วย Swagger**
