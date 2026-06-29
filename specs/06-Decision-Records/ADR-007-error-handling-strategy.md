# ADR-007: Error Handling & Recovery Strategy

**Status:** ✅ Accepted (Implementation Ready)
**Date:** 2026-04-04
**Decision Makers:** Development Team, System Architect
**Related Documents:**

- [API Design & Error Handling](../02-Architecture/02-04-api-design.md)
- [ADR-010: Logging & Monitoring Strategy](./ADR-010-logging-monitoring-strategy.md)
- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:
- **API Design & Error Handling** - Section 6: "ระบบต้องมี Global Exception Filter และ Custom Business Exceptions"
  - เหตุผล: ต้องการบันทึกการตัดสินใจเกี่ยวกับ Error Handling Patterns ที่ใช้จริง
- **Backend Guidelines** - Section 4: "การจัดการ Errors ต้องสอดคล้องกันและมีความหมายต่อ User"
  - เหตุผล: ต้องการทำให้ Error Messages และ Recovery Patterns เป็นมาตรฐาน

### แก้ไขความขัดแย้ง:
- **Technical Details** vs **User Experience**: ต้องการ log technical errors แต่แสดง user-friendly messages
  - การตัดสินใจนี้ช่วยแก้ไขโดย: แยก technical logging และ user-facing error messages

---

## Context and Problem Statement

LCBP3-DMS ต้องการ Error Handling Strategy ที่:

1. **Consistent:** ทุก Error ใช้ Formats และ Patterns เดียวกัน
2. **User-Friendly:** Error messages เข้าใจง่ายสำหรับ non-technical users
3. **Debuggable:** Technical details สำหรับ developers และ ops
4. **Recoverable:** 用户提供 recovery options เมื่อเป็นไปได้
5. **Secure:** ไม่เปิดเผย sensitive information ใน error responses

### Key Challenges

1. **Error Classification:** การจำแนกประเภท errors (validation, business, system)
2. **Message Localization:** รองรับภาษาไทยและอังกฤษ
3. **Recovery Guidance:** แนะนำ users ว่าควรทำอย่างไรต่อ
4. **Cross-Module Consistency:** Errors จาก modules ต่างกันต้องสอดคล้อง
5. **Performance Impact:** Error handling ไม่ควส่งผลกระทบ performance

---

## Decision Drivers

- **User Experience:** Errors ไม่ควสร้างความสับสนหรือความกลัว
- **Debuggability:** Developers สามารถหา root cause ได้เร็ว
- **Security:** ไม่เปิดเผย internal details สู่ users
- **Maintainability:** ง่ายต่อการ add new error types
- **Compliance:** Audit trail สำหรับ errors และ recovery actions
- **Performance:** Error handling ไม่ควส่งผลกระทบ response times

---

## Considered Options

### Option 1: HTTP Status Codes Only

**แนวทาง:** ใช้เพียง HTTP status codes และ generic messages

**Pros:**

- ✅ Simple implementation
- ✅ Standard HTTP semantics
- ✅ Low overhead

**Cons:**

- ❌ Limited error information
- ❌ Poor user experience
- ❌ Difficult debugging
- ❌ No recovery guidance

### Option 2: Custom Error Objects with Details

**แนวทาง:** สร้าง custom error objects พร้อม detailed information

**Pros:**

- ✅ Rich error information
- ✅ Better debugging
- ✅ Recovery guidance possible

**Cons:**

- ❌ More complex implementation
- ❌ Risk of information leakage
- ❌ Larger response sizes

### Option 3: **Layered Error Handling with Classification** ⭐ (Selected)

**แนวทาง:** Classify errors และ provide appropriate detail levels

**Pros:**

- ✅ **Balanced Approach:** User-friendly + technical details
- ✅ **Security:** Control information exposure by error type
- ✅ **Recovery Focus:** Actionable error messages
- ✅ **Consistency:** Standard patterns across modules
- ✅ **Localization Ready:** Support for multiple languages

**Cons:**

- ❌ Requires error classification discipline
- ❌ More initial setup

---

## Decision Outcome

**Chosen Option:** Option 3 - Layered Error Handling with Classification

### Rationale

เลือก Layered Approach เนื่องจาก:

1. **User-Centric:** Error messages ที่เข้าใจง่ายและมีประโยชน์
2. **Developer-Friendly:** Technical details สำหรับ debugging
3. **Security:** Controlled information exposure
4. **Scalability:** ง่ายต่อการ add new error types
5. **Compliance:** Audit trail สำหรับ error tracking

---

## 🔍 Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ)

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **Global Exception Filter** | 🔴 High | Centralized error processing | Implement layered filter |
| **Custom Exceptions** | 🔴 High | Business-specific error types | Create exception hierarchy |
| **Error DTOs** | 🔴 High | Standardized error responses | Define response schemas |
| **Frontend Error Handling** | 🟡 Medium | Parse and display errors appropriately | Update error UI components |
| **Logging Strategy** | 🟡 Medium | Log appropriate detail levels | Integrate with ADR-010 |
| **Documentation** | 🟡 Medium | Error catalog and handling guide | Create error reference |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ)

#### 🔴 Critical Changes (ต้องทำทันที)
- [ ] **Create Exception Hierarchy** - base classes และ specific types
- [ ] **Implement Global Filter** - layered error processing
- [ ] **Define Error DTOs** - standardized response format
- [ ] **Update All Controllers** - use new exception types

#### 🟡 Important Changes (ควรทำภายใน 1 สัปดาห์)
- [ ] **Create Error Catalog** - all possible errors และ recovery actions
- [ ] **Update Frontend Error Handling** - parse and display appropriately
- [ ] **Add Error Logging** - integrate with logging strategy
- [ ] **Create Error Tests** - unit and integration tests

#### 🟢 Nice-to-Have (ทำถ้ามีเวลา)
- [ ] **Error Analytics** - track error rates and patterns
- [ ] **Error Recovery UI** - guided recovery flows
- [ ] **Error Localization** - Thai/English message support

---

## Implementation Details

### Error Classification System

#### Error Types

```typescript
export enum ErrorType {
  // User Errors (400 range)
  VALIDATION = 'VALIDATION',
  BUSINESS_RULE = 'BUSINESS_RULE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // System Errors (500 range)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INFRASTRUCTURE = 'INFRASTRUCTURE'
}

export enum ErrorSeverity {
  LOW = 'LOW',       // User mistake, easy recovery
  MEDIUM = 'MEDIUM', // Business rule violation, needs action
  HIGH = 'HIGH',     // System issue, may need support
  CRITICAL = 'CRITICAL' // System failure, immediate attention
}
```

#### Exception Hierarchy

```typescript
// Base Exception
export abstract class BaseException extends HttpException {
  constructor(
    public readonly type: ErrorType,
    public readonly code: string,
    public readonly message: string,
    public readonly userMessage?: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly details?: any,
    public readonly recoveryActions?: string[]
  ) {
    super(
      {
        error: {
          type,
          code,
          message: userMessage || message,
          severity,
          timestamp: new Date().toISOString(),
          ...(recoveryActions && { recoveryActions }),
          ...(process.env.NODE_ENV === 'development' && {
            technicalMessage: message,
            details
          })
        }
      },
      getStatusCode(type)
    );
  }
}

// Validation Errors
export class ValidationException extends BaseException {
  constructor(message: string, details?: ValidationErrorDetail[]) {
    super(
      ErrorType.VALIDATION,
      'VALIDATION_ERROR',
      message,
      'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
      ErrorSeverity.LOW,
      details,
      ['ตรวจสอบข้อมูลที่กรอก', 'แก้ไขข้อมูลที่ผิดพลาด', 'ลองใหม่อีกครั้ง']
    );
  }
}

// Business Rule Errors
export class BusinessException extends BaseException {
  constructor(code: string, message: string, userMessage?: string, recoveryActions?: string[]) {
    super(
      ErrorType.BUSINESS_RULE,
      code,
      message,
      userMessage || 'ไม่สามารถดำเนินการได้เนื่องจากเงื่อนไขทางธุรกิจ',
      ErrorSeverity.MEDIUM,
      undefined,
      recoveryActions || ['ติดต่อผู้ดูแลระบบ', 'ตรวจสอบเงื่อนไขการดำเนินการ']
    );
  }
}

// Permission Errors
export class PermissionException extends BaseException {
  constructor(resource: string, action: string) {
    super(
      ErrorType.PERMISSION_DENIED,
      'PERMISSION_DENIED',
      `User lacks permission for ${action} on ${resource}`,
      `คุณไม่มีสิทธิ์${action} ${resource}`,
      ErrorSeverity.MEDIUM,
      { resource, action },
      ['ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์', 'ลองใช้บัญชีที่มีสิทธิ์']
    );
  }
}

// System Errors
export class SystemException extends BaseException {
  constructor(message: string, details?: any) {
    super(
      ErrorType.INTERNAL_ERROR,
      'INTERNAL_ERROR',
      message,
      'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง',
      ErrorSeverity.HIGH,
      details,
      ['ลองใหม่อีกครั้ง', 'ติดต่อผู้ดูแลระบบหากยังไม่ได้']
    );
  }
}
```

### Global Exception Filter

```typescript
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let errorResponse: any;

    if (exception instanceof BaseException) {
      // Handle our custom exceptions
      errorResponse = exception.getResponse();
      this.logError(exception, request, false);
    } else if (exception instanceof HttpException) {
      // Handle NestJS HTTP exceptions
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        error: {
          type: this.getErrorType(status),
          code: 'HTTP_ERROR',
          message: this.getUserMessage(status),
          severity: ErrorSeverity.MEDIUM,
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === 'development' && {
            technicalMessage: exception.message,
            details: exceptionResponse
          })
        }
      };
      this.logError(exception, request, false);
    } else {
      // Handle unexpected errors
      errorResponse = {
        error: {
          type: ErrorType.INTERNAL_ERROR,
          code: 'UNEXPECTED_ERROR',
          message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่ภายหลัง',
          severity: ErrorSeverity.CRITICAL,
          timestamp: new Date().toISOString()
        }
      };
      this.logError(exception, request, true);
    }

    response.status(errorResponse.error.statusCode || 500).json(errorResponse);
  }

  private logError(exception: any, request: Request, isCritical: boolean) {
    const logData = {
      path: request.url,
      method: request.method,
      userId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      body: request.body,
      exception: {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
        details: exception.details
      }
    };

    if (isCritical || exception.severity === ErrorSeverity.CRITICAL) {
      this.logger.error('Critical error occurred', logData);
    } else {
      this.logger.warn('Error occurred', logData);
    }
  }

  private getErrorType(status: number): ErrorType {
    if (status === 400) return ErrorType.VALIDATION;
    if (status === 401) return ErrorType.PERMISSION_DENIED;
    if (status === 403) return ErrorType.PERMISSION_DENIED;
    if (status === 404) return ErrorType.NOT_FOUND;
    if (status === 409) return ErrorType.CONFLICT;
    return ErrorType.INTERNAL_ERROR;
  }

  private getUserMessage(status: number): string {
    switch (status) {
      case 400: return 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
      case 401: return 'กรุณาเข้าสู่ระบบก่อนใช้งาน';
      case 403: return 'คุณไม่มีสิทธิ์ในการดำเนินการนี้';
      case 404: return 'ไม่พบข้อมูลที่ร้องขอ';
      case 409: return 'ข้อมูลซ้ำกันหรือมีความขัดแย้ง';
      default: return 'เกิดข้อผิดพลาดในระบบ';
    }
  }
}
```

### Service Layer Error Handling

```typescript
@Injectable()
export class CorrespondenceService {
  constructor(
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    private logger: Logger
  ) {}

  async create(createDto: CreateCorrespondenceDto, userId: number): Promise<Correspondence> {
    try {
      // Business validation
      if (createDto.originatorId && !await this.canUserCreateForOrganization(userId, createDto.originatorId)) {
        throw new PermissionException('correspondence', 'create for organization');
      }

      // Check for duplicate document number
      if (await this.isDuplicateDocumentNumber(createDto.documentNumber)) {
        throw new BusinessException(
          'DUPLICATE_DOCUMENT_NUMBER',
          `Document number ${createDto.documentNumber} already exists`,
          'เลขที่เอกสารนี้มีอยู่แล้ว กรุณาใช้เลขที่อื่น',
          ['ตรวจสอบเลขที่เอกสารล่าสุด', 'ขอเลขที่เอกสารใหม่']
        );
      }

      // Create correspondence
      const correspondence = this.correspondenceRepo.create({
        ...createDto,
        createdBy: userId,
        createdAt: new Date()
      });

      const saved = await this.correspondenceRepo.save(correspondence);

      this.logger.log(`Correspondence created: ${saved.id}`);
      return saved;

    } catch (error) {
      if (error instanceof BaseException) {
        throw error; // Re-throw our custom exceptions
      }

      // Handle database errors
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BusinessException(
          'DUPLICATE_ENTRY',
          'Database constraint violation',
          'ข้อมูลซ้ำกันในระบบ กรุณาตรวจสอบ'
        );
      }

      // Handle unexpected errors
      this.logger.error('Unexpected error in CorrespondenceService.create', error);
      throw new SystemException('Failed to create correspondence', error);
    }
  }

  async findOne(uuid: string, userId: number): Promise<Correspondence> {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { uuid, deletedAt: IsNull() },
      relations: ['type', 'originator', 'recipients']
    });

    if (!correspondence) {
      throw new BusinessException(
        'CORRESPONDENCE_NOT_FOUND',
        `Correspondence with UUID ${uuid} not found`,
        'ไม่พบเอกสารที่ค้นหา',
        ['ตรวจสอบ UUID ที่ระบุ', 'ค้นหาเอกสารจากรายการ']
      );
    }

    // Check permission
    if (!await this.canUserView(correspondence, userId)) {
      throw new PermissionException('correspondence', 'view');
    }

    return correspondence;
  }
}
```

### Frontend Error Handling

```typescript
// Error response type
interface ErrorResponse {
  error: {
    type: string;
    code: string;
    message: string;
    severity: string;
    timestamp: string;
    recoveryActions?: string[];
    technicalMessage?: string;
    details?: any;
  };
}

// Error handler component
export function ErrorDisplay({ error, onRetry }: { error: ErrorResponse; onRetry?: () => void }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'text-yellow-600';
      case 'MEDIUM': return 'text-orange-600';
      case 'HIGH': return 'text-red-600';
      case 'CRITICAL': return 'text-red-800';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${getSeverityColor(error.error.severity)}`}>
            {error.error.message}
          </h3>

          {error.error.recoveryActions && (
            <div className="mt-2 text-sm text-gray-600">
              <p className="font-medium">วิธีแก้ไข:</p>
              <ul className="list-disc list-inside space-y-1">
                {error.error.recoveryActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                ลองใหม่
              </button>
            )}
            <button className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700">
              ติดต่อผู้ดูแลระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// API service error handling
export class ApiService {
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await axios.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw errorData; // Re-throw structured error
      }
      throw {
        error: {
          type: 'INTERNAL_ERROR',
          code: 'NETWORK_ERROR',
          message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
          severity: 'HIGH',
          timestamp: new Date().toISOString(),
          recoveryActions: ['ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'ลองใหม่ภายหลัง']
        }
      };
    }
  }
}
```

### Error Catalog

| Error Code | Type | User Message | Recovery Actions | Severity |
|------------|------|--------------|------------------|----------|
| `VALIDATION_ERROR` | Validation | ข้อมูลที่กรอกไม่ถูกต้อง | ตรวจสอบข้อมูล, แก้ไข, ลองใหม่ | LOW |
| `DUPLICATE_DOCUMENT_NUMBER` | Business | เลขที่เอกสารซ้ำกัน | ตรวจสอบเลขล่าสุด, ขอเลขใหม่ | MEDIUM |
| `CORRESPONDENCE_NOT_FOUND` | Business | ไม่พบเอกสาร | ตรวจสอบ UUID, ค้นหาใหม่ | MEDIUM |
| `PERMISSION_DENIED` | Permission | ไม่มีสิทธิ์ดำเนินการ | ติดต่อ admin, ใช้บัญชีอื่น | MEDIUM |
| `WORKFLOW_INVALID_TRANSITION` | Business | ไม่สามารถดำเนินการได้ในสถานะปัจจุบัน | ตรวจสอบ workflow, ดำเนินการอื่น | MEDIUM |
| `INTERNAL_ERROR` | System | เกิดข้อผิดพลาดในระบบ | ลองใหม่, ติดต่อ admin | HIGH |
| `DATABASE_ERROR` | System | ฐานข้อมูลมีปัญหา | ลองใหม่ภายหลัง, แจ้ง admin | HIGH |
| `EXTERNAL_SERVICE` | System | บริการภายนอกมีปัญหา | ลองใหม่ภายหลัง | MEDIUM |

---

## Consequences

### Positive

1. ✅ **User Experience:** Clear, actionable error messages
2. ✅ **Debuggability:** Technical details available when needed
3. ✅ **Consistency:** Standard error handling across all modules
4. ✅ **Security:** Controlled information exposure
5. ✅ **Recovery:** Users know what to do when errors occur
6. ✅ **Maintainability:** Easy to add new error types

### Negative

1. ❌ **Initial Complexity:** ต้อง setup exception hierarchy
2. ❌ **Development Overhead:** ต้องคิด error messages และ recovery actions
3. ❌ **Response Size:** Error responses ใหญ่ขึ้นเล็กน้อย

### Mitigation Strategies

- **Complexity:** Provide comprehensive templates and examples
- **Development Overhead:** Create error catalog and guidelines
- **Response Size:** Optimize and compress where needed

---

## 🔄 Review Cycle & Maintenance

### Review Schedule
- **Next Review:** 2026-10-04 (6 months from creation)
- **Review Type:** Scheduled (Error Strategy Review)
- **Reviewers:** System Architect, Backend Team Lead, Frontend Team Lead

### Review Checklist
- [ ] Error messages ยังเข้าใจง่ายสำหรับ users หรือไม่?
- [ ] Recovery actions ยังมีประสิทธิภาพหรือไม่?
- [ ] มี error patterns ใหม่ที่ควรเพิ่มหรือไม่?
- [ ] ต้องการ update หรือ deprecate error types ใดหรือไม่?

### Version History
| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2026-04-04 | Initial version - Layered Error Handling Strategy | ✅ Accepted |

---

## Compliance

เป็นไปตาม:

- [API Design & Error Handling](../02-Architecture/02-04-api-design.md)
- [ADR-010: Logging & Monitoring Strategy](./ADR-010-logging-monitoring-strategy.md)
- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md)

---

## Related ADRs

- [ADR-010: Logging & Monitoring Strategy](./ADR-010-logging-monitoring-strategy.md) - Error logging
- [ADR-003: API Design Strategy](./ADR-003-api-design-strategy.md) - Error response format
- [ADR-016: Security Authentication](./ADR-016-security-authentication.md) - Permission errors

---

## References

- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [HTTP Status Codes](https://httpstatuses.com/)
- [Error Handling Best Practices](https://martinfowler.com/articles/error-handling-patterns.html)
