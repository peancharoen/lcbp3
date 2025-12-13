# 🌐 API Design Specification

---

**title:** 'API Design'
**version:** 1.6.0
**status:** active
**owner:** Nattanin Peancharoen
**last_updated:** 2025-12-02
**related:**

- specs/01-requirements/02-architecture.md
- specs/02-architecture/system-architecture.md
- specs/03-implementation/fullftack-js-v1.5.0.md

---

## 📋ภาพรวม (Overview)

เอกสารนี้กำหนดมาตรฐานการออกแบบ API สำหรับระบบ LCBP3-DMS โดยใช้แนวทาง **API-First Design** ที่เน้นความชัดเจน ความสอดคล้อง และความปลอดภัย

## 🎯 หลักการออกแบบ API (API Design Principles)

### 1.1 API-First Approach

- **ออกแบบ API ก่อนการ Implement:** ทำการออกแบบ API Endpoint และ Data Contract ให้ชัดเจนก่อนเริ่มเขียนโค้ด
- **Documentation-Driven:** ใช้ OpenAPI/Swagger เป็นเอกสารอ้างอิงหลัก
- **Contract Testing:** ทดสอบ API ตาม Contract ที่กำหนดไว้

### 1.2 RESTful Principles

- ใช้ HTTP Methods อย่างถูกต้อง: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- ใช้ HTTP Status Codes ที่เหมาะสม
- Resource-Based URL Design
- Stateless Communication

### 1.3 Consistency & Predictability

- **Naming Conventions:** ใช้ `kebab-case` สำหรับ URL paths
- **Property Naming:** ใช้ `camelCase` สำหรับ JSON properties และ query parameters (สอดคล้องกับ TypeScript/JavaScript conventions)
- **Database Columns:** Database ใช้ `snake_case` (mapped via TypeORM decorators)
- **Versioning:** รองรับการ Version API ผ่าน URL path (`/api/v1/...`)

## 🔐 Authentication & Authorization

### 2.1 Authentication

- **JWT-Based Authentication:** ใช้ JSON Web Token สำหรับการยืนยันตัวตน
- **Token Management:**
  - Access Token Expiration: 8 ชั่วโมง
  - Refresh Token Expiration: 7 วัน
  - Token Rotation: รองรับการหมุนเวียน Refresh Token
  - Token Revocation: บันทึก Revoked Tokens จนกว่าจะหมดอายุ

**Endpoints:**

```typescript
POST / api / v1 / auth / login;
POST / api / v1 / auth / logout;
POST / api / v1 / auth / refresh;
POST / api / v1 / auth / change - password;
```

### 2.2 Authorization (RBAC)

- **4-Level Permission Hierarchy:**

  1. **Global Level:** System-wide permissions (Superadmin)
  2. **Organization Level:** Organization-specific permissions
  3. **Project Level:** Project-specific permissions
  4. **Contract Level:** Contract-specific permissions

- **Permission Checking:** ใช้ Decorator `@RequirePermission('resource.action')`

**Example:**

```typescript
@RequirePermission('correspondence.create')
@Post('correspondences')
async createCorrespondence(@Body() dto: CreateCorrespondenceDto) {
  // Implementation
}
```

### 2.3 Token Payload Optimization

- JWT Payload เก็บเฉพาะ `userId` และ `scope` ปัจจุบัน
- **Permissions Caching:** เก็บ Permission List ใน Redis และดึงมาตรวจสอบเมื่อมี Request

## 📡 API Conventions

### 3.1 Base URL Structure

```
https://backend.np-dms.work/api/v1/{resource}
```

### 3.2 HTTP Methods & Usage

| Method   | Usage                        | Idempotent | Example                              |
| :------- | :--------------------------- | :--------- | :----------------------------------- |
| `GET`    | ดึงข้อมูล (Read)                | ✅ Yes      | `GET /api/v1/correspondences`        |
| `POST`   | สร้างข้อมูลใหม่ (Create)         | ❌ No\*     | `POST /api/v1/correspondences`       |
| `PUT`    | อัปเดตทั้งหมด (Full Update)     | ✅ Yes      | `PUT /api/v1/correspondences/:id`    |
| `PATCH`  | อัปเดตบางส่วน (Partial Update) | ✅ Yes      | `PATCH /api/v1/correspondences/:id`  |
| `DELETE` | ลบข้อมูล (Soft Delete)         | ✅ Yes      | `DELETE /api/v1/correspondences/:id` |

**Note:** `POST` เป็น Idempotent ได้เมื่อใช้ `Idempotency-Key` Header

### 3.3 HTTP Status Codes

| Status Code                 | Usage                          |
| :-------------------------- | :----------------------------- |
| `200 OK`                    | Request สำเร็จ (GET, PUT, PATCH) |
| `201 Created`               | สร้างข้อมูลสำเร็จ (POST)            |
| `204 No Content`            | ลบสำเร็จ (DELETE)                |
| `400 Bad Request`           | ข้อมูล Request ไม่ถูกต้อง           |
| `401 Unauthorized`          | ไม่มี Token หรือ Token หมดอายุ     |
| `403 Forbidden`             | ไม่มีสิทธิ์เข้าถึง                    |
| `404 Not Found`             | ไม่พบข้อมูล                       |
| `409 Conflict`              | ข้อมูลซ้ำ หรือ State Conflict       |
| `422 Unprocessable Entity`  | Validation Error               |
| `429 Too Many Requests`     | Rate Limit Exceeded            |
| `500 Internal Server Error` | Server Error                   |
| `503 Service Unavailable`   | Maintenance Mode               |

### 3.4 Request & Response Format

**Request Headers:**

```http
Content-Type: application/json
Authorization: Bearer <access_token>
Idempotency-Key: <uuid> # สำหรับ POST/PUT/DELETE
```

**Success Response Format:**

```typescript
{
  "success": true,
  "data": {
    // Resource data
  },
  "message": "Operation completed successfully"
}
```

**Error Response Format:**

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "timestamp": "2025-11-30T13:48:20Z",
  "path": "/api/v1/users"
}
```

## 🔄 Idempotency

### 4.1 Implementation

- **ทุก Critical Operation** (Create, Update, Delete) ต้องรองรับ Idempotency
- Client ส่ง Header: `Idempotency-Key: <uuid>`
- Server เช็คว่า Key นี้เคยประมวลผลสำเร็จแล้วหรือไม่
- ถ้าเคยทำแล้ว: ส่งผลลัพธ์เดิมกลับไป (ไม่ทำซ้ำ)

**Example:**

```http
POST /api/v1/correspondences
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "title": "New Correspondence",
  "type_id": 1
}
```

## 📊 Pagination, Filtering & Sorting

### 5.1 Pagination (Server-Side)

**Query Parameters:**

```
GET /api/v1/correspondences?page=1&page_size=20
```

**Response:**

```typescript
{
  "success": true,
  "data": [...],
  "meta": {
    "current_page": 1,
    "page_size": 20,
    "total_items": 150,
    "total_pages": 8,
    "has_next_page": true,
    "has_previous_page": false
  }
}
```

### 5.2 Filtering

```
GET /api/v1/correspondences?project_id=1&status=PENDING
```

### 5.3 Sorting

```
GET /api/v1/correspondences?sort=createdAt&order=desc
```

### 5.4 Combined Example

```
GET /api/v1/correspondences?project_id=1&status=PENDING&page=1&page_size=20&sort=createdAt&order=desc
```

## 🛡️ Security Features

### 6.1 Rate Limiting

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

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638360000
```

### 6.2 Input Validation

- **DTOs with Class Validator:** ทุก Request ต้องผ่าน Validation
- **XSS Protection:** Input Sanitization
- **SQL Injection Prevention:** ใช้ ORM (TypeORM) Parameterized Queries
- **CSRF Protection:** CSRF Tokens สำหรับ State-Changing Operations

### 6.3 File Upload Security

**Endpoint:**

```
POST /api/v1/files/upload
```

**Security Measures:**

- **Virus Scanning:** ใช้ ClamAV scan ทุกไฟล์
- **File Type Validation:** White-list (PDF, DWG, DOCX, XLSX, ZIP)
- **File Size Limit:** 50MB per file
- **Two-Phase Storage:**
  1. Upload to `temp/` folder
  2. Commit to `permanent/{YYYY}/{MM}/` when operation succeeds

**Response:**

```typescript
{
  "success": true,
  "data": {
    "temp_id": "uuid",
    "filename": "document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "scan_status": "CLEAN"
  }
}
```

## 📦 Core Module APIs

### 7.1 Correspondence Module

**Base Path:** `/api/v1/correspondences`

| Method | Endpoint                           | Permission              | Description           |
| :----- | :--------------------------------- | :---------------------- | :-------------------- |
| GET    | `/correspondences`                 | `correspondence.view`   | รายการ Correspondence |
| GET    | `/correspondences/:id`             | `correspondence.view`   | รายละเอียด             |
| POST   | `/correspondences`                 | `correspondence.create` | สร้างใหม่               |
| PUT    | `/correspondences/:id`             | `correspondence.update` | อัปเดตทั้งหมด            |
| PATCH  | `/correspondences/:id`             | `correspondence.update` | อัปเดตบางส่วน           |
| DELETE | `/correspondences/:id`             | `correspondence.delete` | ลบ (Soft Delete)      |
| POST   | `/correspondences/:id/revisions`   | `correspondence.update` | สร้าง Revision ใหม่     |
| GET    | `/correspondences/:id/revisions`   | `correspondence.view`   | ดู Revisions ทั้งหมด     |
| POST   | `/correspondences/:id/attachments` | `correspondence.update` | เพิ่มไฟล์แนบ             |

### 7.2 RFA Module

**Base Path:** `/api/v1/rfas`

| Method | Endpoint              | Permission     | Description       |
| :----- | :-------------------- | :------------- | :---------------- |
| GET    | `/rfas`               | `rfas.view`    | รายการ RFA        |
| GET    | `/rfas/:id`           | `rfas.view`    | รายละเอียด         |
| POST   | `/rfas`               | `rfas.create`  | สร้างใหม่           |
| PUT    | `/rfas/:id`           | `rfas.update`  | อัปเดต             |
| DELETE | `/rfas/:id`           | `rfas.delete`  | ลบ                |
| POST   | `/rfas/:id/respond`   | `rfas.respond` | ตอบกลับ RFA        |
| POST   | `/rfas/:id/approve`   | `rfas.approve` | อนุมัติ RFA          |
| POST   | `/rfas/:id/revisions` | `rfas.update`  | สร้าง Revision     |
| GET    | `/rfas/:id/workflow`  | `rfas.view`    | ดู Workflow Status |

### 7.3 Drawing Module

**Base Path:** `/api/v1/drawings`

**Shop Drawings:**

| Method | Endpoint                       | Permission        | Description         |
| :----- | :----------------------------- | :---------------- | :------------------ |
| GET    | `/shop-drawings`               | `drawings.view`   | รายการ Shop Drawing |
| POST   | `/shop-drawings`               | `drawings.upload` | อัปโหลดใหม่           |
| GET    | `/shop-drawings/:id/revisions` | `drawings.view`   | ดู Revisions         |

**Contract Drawings:**

| Method | Endpoint             | Permission        | Description             |
| :----- | :------------------- | :---------------- | :---------------------- |
| GET    | `/contract-drawings` | `drawings.view`   | รายการ Contract Drawing |
| POST   | `/contract-drawings` | `drawings.upload` | อัปโหลดใหม่               |

### 7.4 Project Module

**Base Path:** `/api/v1/projects`

| Method | Endpoint                  | Permission               | Description       |
| :----- | :------------------------ | :----------------------- | :---------------- |
| GET    | `/projects`               | `projects.view`          | รายการโครงการ     |
| GET    | `/projects/:id`           | `projects.view`          | รายละเอียด         |
| POST   | `/projects`               | `projects.create`        | สร้างโครงการใหม่    |
| PUT    | `/projects/:id`           | `projects.update`        | อัปเดต             |
| POST   | `/projects/:id/contracts` | `contracts.create`       | สร้าง Contract     |
| GET    | `/projects/:id/parties`   | `projects.view`          | ดู Project Parties |
| POST   | `/projects/:id/parties`   | `project_parties.manage` | เพิ่ม Party         |

### 7.5 User & Auth Module

**Base Path:** `/api/v1/users`, `/api/v1/auth`

**Authentication:**

```typescript
POST / api / v1 / auth / login;
POST / api / v1 / auth / logout;
POST / api / v1 / auth / refresh;
POST / api / v1 / auth / change - password;
POST / api / v1 / auth / reset - password;
```

**User Management:**

```typescript
GET    /api/v1/users              # List users
GET    /api/v1/users/:id          # User details
POST   /api/v1/users              # Create user
PUT    /api/v1/users/:id          # Update user
DELETE /api/v1/users/:id          # Delete user
POST   /api/v1/users/:id/roles    # Assign roles
GET    /api/v1/users/me           # Current user info
GET    /api/v1/users/me/permissions # Current user permissions
```

### 7.6 Search Module

**Base Path:** `/api/v1/search`

```typescript
GET /api/v1/search?q=<query>&type=<correspondence|rfa|drawing>&project_id=<id>
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "results": [...],
    "aggregations": {
      "by_type": { "correspondence": 10, "rfa": 5 },
      "by_status": { "PENDING": 8, "APPROVED": 7 }
    }
  },
  "meta": {
    "total": 15,
    "took_ms": 45
  }
}
```

## 🔔 Notification API

**Base Path:** `/api/v1/notifications`

```typescript
GET    /api/v1/notifications           # List notifications
GET    /api/v1/notifications/:id       # Notification details
PATCH  /api/v1/notifications/:id/read  # Mark as read
DELETE /api/v1/notifications/:id       # Delete notification
```

## 📈 Reporting & Export APIs

**Base Path:** `/api/v1/reports`

```typescript
GET /api/v1/reports/correspondences?format=csv&project_id=1&from=2025-01-01&to=2025-12-31
GET /api/v1/reports/rfas?format=excel&project_id=1
GET /api/v1/reports/dashboard # Dashboard KPIs
```

**Supported Formats:**

- `csv` - CSV file
- `excel` - Excel file (.xlsx)
- `pdf` - PDF file

## 🔧 Workflow Engine API

**Base Path:** `/api/v1/workflows`

```typescript
GET    /api/v1/workflows/definitions              # List workflow definitions
GET    /api/v1/workflows/definitions/:id          # Definition details
POST   /api/v1/workflows/instances                # Create workflow instance
GET    /api/v1/workflows/instances/:id            # Instance details
POST   /api/v1/workflows/instances/:id/transition # Execute transition
GET    /api/v1/workflows/instances/:id/history    # View history
```

## ⚡ Performance Optimization

### 11.1 Caching Strategy

**Cache Headers:**

```http
Cache-Control: max-age=3600, private
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

**Cache TTL:**

- Master Data: 1 hour
- User Sessions: 30 minutes
- Search Results: 15 minutes
- File Metadata: 1 hour

### 11.2 Response Compression

```http
Accept-Encoding: gzip, deflate, br
Content-Encoding: gzip
```

## 🧪 Testing & Documentation

### 12.1 API Documentation

- **Swagger/OpenAPI:** Auto-generated จาก NestJS Decorators
- **URL:** `https://backend.np-dms.work/api/docs`

### 12.2 Testing Strategy

- **Unit Tests:** Test individual controllers & services
- **Integration Tests:** Test API endpoints with database
- **E2E Tests:** Test complete user flows
- **Contract Tests:** Verify API contracts

## 🚦 Health Check & Monitoring

```typescript
GET /health              # Health check endpoint
GET /health/ready        # Readiness probe
GET /health/live         # Liveness probe
GET /metrics             # Prometheus metrics
```

**Response:**

```typescript
{
  "status": "ok",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "elasticsearch": "ok"
  }
}
```

## 📝 API Versioning Strategy

### 14.1 Versioning Approach

- **URL-Based Versioning:** `/api/v1/...`, `/api/v2/...`
- **Backward Compatibility:** รองรับ API เวอร์ชันเก่าอย่างน้อย 1 เวอร์ชัน
- **Deprecation Headers:**

```http
X-API-Deprecation-Warning: This endpoint will be deprecated on 2026-01-01
X-API-Deprecation-Info: https://docs.np-dms.work/migration/v2
```

## 🎯 Best Practices Summary

1. **ใช้ DTOs สำหรับ Validation ทุก Request**
2. **ส่ง Idempotency-Key สำหรับ Critical Operations**
3. **ใช้ Proper HTTP Status Codes**
4. **Implement Rate Limiting บน Client Side**
5. **Handle Errors Gracefully**
6. **Cache Frequently-Accessed Data**
7. **Use Pagination สำหรับ Large Datasets**
8. **Document ทุก Endpoint ด้วย Swagger**

---

**Document Control:**

- **Version:** 1.6.0
- **Status:** Active
- **Last Updated:** 2025-12-13
- **Owner:** Nattanin Peancharoen
