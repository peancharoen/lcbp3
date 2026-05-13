
# ADR-007 Error Handling Strategy

## CRITICAL RULES

- **ALWAYS** use layered error classification (Validation, Business, System)
- **NEVER** expose technical details to end users
- **ALWAYS** provide user-friendly error messages with recovery guidance
- **ALWAYS** log technical details for debugging
- **NEVER** use generic error messages without context

## Error Classification

| Error Type | Description | User Message | Technical Log |
|------------|-------------|--------------|---------------|
| **Validation** | Input validation failures | Clear field-level errors | Full validation details |
| **Business** | Business rule violations | Actionable guidance | Business context + user ID |
| **System** | Infrastructure failures | Generic "try again" | Full stack trace + metrics |

## Backend Pattern (NestJS)

```typescript
// Custom Exception Hierarchy
export class BusinessException extends HttpException {
  constructor(
    message: string,
    userMessage: string,
    recoveryAction?: string,
    errorCode?: string
  ) {
    super({ message, userMessage, recoveryAction, errorCode }, 400);
  }
}

// Global Exception Filter
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Classify error and provide appropriate response
    // Log technical details
    // Return user-friendly message
  }
}
```

## Frontend Pattern (Next.js)

```typescript
// Error Display Component
const ErrorDisplay = ({ error, onRetry }) => {
  const userMessage = error.userMessage || 'เกิดข้อผิดพลาด';
  const recoveryAction = error.recoveryAction;

  return (
    <div>
      <p>{userMessage}</p>
      {recoveryAction && <p>{recoveryAction}</p>}
      {onRetry && <button onClick={onRetry}>ลองใหม่</button>}
    </div>
  );
};
```

## Required Implementation

- [ ] Global Exception Filter with layered classification
- [ ] Custom exception hierarchy (Validation, Business, System)
- [ ] Standardized error response DTOs
- [ ] Frontend error display components
- [ ] Error recovery mechanisms where applicable

## Related Documents

- `specs/06-Decision-Records/ADR-007-error-handling-strategy.md`
- `specs/06-Decision-Records/ADR-010-logging-monitoring-strategy.md`
