# Task BE-ERR-01: Error Handling & Recovery Strategy Implementation

**Phase:** Error Handling Standardization
**ADR Compliance:** ADR-007 (Error Handling & Recovery), ADR-010 (Logging & Monitoring)
**Priority:** 🟡 Important - User Experience & Debuggability

> **Context:** การ implement Layered Error Handling ตาม ADR-007 เพื่อให้ error messages สอดคล้องกันและมีประโยชน์ต่อ users

---

## 📋 Implementation Tasks

### **ERR-1.1: Exception Hierarchy Implementation**
- [ ] **Create Base Exception Classes:**
  - File: `backend/src/common/exceptions/base.exception.ts`
  - Classes: `BaseException`, `ValidationException`, `BusinessException`
  - Features: Error classification, user messages, recovery actions
- [ ] **Create Specific Exception Types:**
  - File: `backend/src/common/exceptions/`
  - Types: `PermissionException`, `SystemException`, `WorkflowException`
  - Properties: Error codes, severity levels, recovery guidance
- [ ] **Implement Error Severity System:**
  - Enum: `ErrorSeverity` (LOW, MEDIUM, HIGH, CRITICAL)
  - Logic: Different handling based on severity
  - Integration: Logging levels and alerting

### **ERR-1.2: Global Exception Filter**
- [ ] **Create Global Exception Filter:**
  - File: `backend/src/common/filters/global-exception.filter.ts`
  - Features: Layered error processing, information control
  - Integration: NestJS exception handling pipeline
- [ ] **Implement Error Classification:**
  - Logic: Categorize errors by type and severity
  - Response format: Standardized error responses
  - Development vs Production: Different detail levels
- [ ] **Add Error Logging Integration:**
  - Integration: ADR-010 logging strategy
  - Context: Request information, user details, stack traces
  - Performance: Async logging to avoid blocking

### **ERR-1.3: Service Layer Error Handling**
- [ ] **Update Correspondence Service:**
  - File: `backend/src/modules/correspondence/correspondence.service.ts`
  - Methods: Use custom exceptions instead of generic errors
  - Validation: Business rule validation with proper errors
  - Recovery: Provide actionable error messages
- [ ] **Update RFA Service:**
  - File: `backend/src/modules/rfa/rfa.service.ts`
  - Workflow errors: Invalid transitions, permission issues
  - Document numbering: Duplicate numbers, format errors
  - Integration: Workflow engine error handling
- [ ] **Update All Other Services:**
  - Directory: `backend/src/modules/*/services/`
  - Pattern: Consistent error handling across all modules
  - Validation: Input validation with detailed errors

### **ERR-1.4: Frontend Error Handling**
- [ ] **Create Error Display Component:**
  - File: `frontend/components/common/error-display.tsx`
  - Features: User-friendly error messages, recovery actions
  - Styling: Consistent with design system
  - Localization: Support for Thai/English messages
- [ ] **Update API Client Error Handling:**
  - File: `frontend/lib/api/client.ts`
  - Logic: Parse structured error responses
  - Actions: Display appropriate recovery options
  - Integration: Global error state management
- [ ] **Implement Error Recovery UI:**
  - Features: Retry buttons, alternative actions, help links
  - Context: Different recovery flows per error type
  - User Experience: Clear guidance and next steps

### **ERR-1.5: Error Catalog & Documentation**
- [ ] **Create Error Catalog:**
  - File: `docs/error-catalog.md`
  - Content: All error codes, messages, recovery actions
  - Format: Structured table with examples
  - Maintenance: Process for adding new errors
- [ ] **Implement Error Analytics:**
  - Tracking: Error rates, patterns, user impact
  - Dashboard: Error monitoring and alerting
  - Integration: ADR-010 monitoring strategy
- [ ] **Create Error Handling Guidelines:**
  - Document: Developer guidelines for error handling
  - Examples: Common patterns and best practices
  - Review: Code review checklist for errors

---

## 🔧 Technical Implementation Details

### Exception Hierarchy

```typescript
// File: backend/src/common/exceptions/base.exception.ts
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  BUSINESS_RULE = 'BUSINESS_RULE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
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
```

### Global Exception Filter

```typescript
// File: backend/src/common/filters/global-exception.filter.ts
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
}
```

### Service Layer Example

```typescript
// File: backend/src/modules/correspondence/correspondence.service.ts
@Injectable()
export class CorrespondenceService {
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
}
```

### Frontend Error Display Component

```typescript
// File: frontend/components/common/error-display.tsx
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
```

### Error Catalog Structure

```markdown
# Error Catalog

| Error Code | Type | User Message | Recovery Actions | Severity | Module |
|------------|------|--------------|------------------|----------|--------|
| VALIDATION_ERROR | Validation | ข้อมูลที่กรอกไม่ถูกต้อง | ตรวจสอบข้อมูล, แก้ไข, ลองใหม่ | LOW | All |
| DUPLICATE_DOCUMENT_NUMBER | Business | เลขที่เอกสารซ้ำกัน | ตรวจสอบเลขล่าสุด, ขอเลขใหม่ | MEDIUM | Correspondence |
| CORRESPONDENCE_NOT_FOUND | Business | ไม่พบเอกสาร | ตรวจสอบ UUID, ค้นหาใหม่ | MEDIUM | Correspondence |
| PERMISSION_DENIED | Permission | ไม่มีสิทธิ์ดำเนินการ | ติดต่อ admin, ใช้บัญชีอื่น | MEDIUM | All |
| WORKFLOW_INVALID_TRANSITION | Business | ไม่สามารถดำเนินการได้ในสถานะปัจจุบัน | ตรวจสอบ workflow, ดำเนินการอื่น | MEDIUM | Workflow |
| INTERNAL_ERROR | System | เกิดข้อผิดพลาดในระบบ | ลองใหม่, ติดต่อ admin | HIGH | All |
| DATABASE_ERROR | System | ฐานข้อมูลมีปัญหา | ลองใหม่ภายหลัง, แจ้ง admin | HIGH | All |
| EXTERNAL_SERVICE | System | บริการภายนอกมีปัญหา | ลองใหม่ภายหลัง | MEDIUM | Notification |
```

---

## 📊 Success Criteria

### Functional Requirements
- [ ] Exception hierarchy implemented
- [ ] Global exception filter working
- [ ] All services use custom exceptions
- [ ] Frontend displays user-friendly errors
- [ ] Error catalog complete

### Non-Functional Requirements
- [ ] Error responses consistent across all endpoints
- [ ] Error logging integrated with ADR-010
- [ ] User recovery guidance actionable
- [ ] Technical details controlled in production
- [ ] Error analytics and monitoring

### Compliance Requirements
- [ ] ADR-007 patterns followed consistently
- [ ] ADR-010 logging integrated
- [ ] Security: No information leakage
- [ ] Accessibility: Error messages understandable

---

## 🚀 Deployment & Rollout

### Phase 1: Backend Implementation (Week 1)
- Create exception hierarchy
- Implement global filter
- Update core services

### Phase 2: Service Updates (Week 2)
- Update all service methods
- Add comprehensive error handling
- Create error catalog

### Phase 3: Frontend Integration (Week 3)
- Update error display components
- Implement recovery UI
- Add error analytics

---

## 📋 Dependencies & Prerequisites

### Must Have
- ✅ ADR-007 Approved
- ✅ ADR-010 Logging Strategy
- ✅ NestJS framework setup
- ✅ Frontend error state management

### Nice to Have
- Error monitoring dashboard
- Automated error testing
- Error localization framework

---

## 🔄 Review & Acceptance

### Code Review Checklist
- [ ] Exception hierarchy comprehensive
- [ ] Global filter handles all cases
- [ ] Services use proper exceptions
- [ ] Frontend error handling user-friendly
- [ ] Error catalog complete
- [ ] No information leakage

### Acceptance Criteria
- [ ] All errors use custom exceptions
- [ ] Error responses standardized
- [ ] User recovery guidance clear
- [ ] Technical details controlled
- [ ] Error logging comprehensive
- [ ] Frontend error handling tested

---

**Owner:** Backend Team Lead + Frontend Team Lead  
**Estimated Effort:** 3 weeks (1-2 developers)  
**Risk Level:** Low (Improvement, no breaking changes)  
**Rollback Plan:** Revert to previous error handling
