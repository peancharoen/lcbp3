// File: src/common/exceptions/index.ts
// Barrel export สำหรับ Exception Hierarchy ทั้งหมด

export {
  ErrorType,
  ErrorSeverity,
  getStatusCode,
  BaseException,
  ValidationException,
  BusinessException,
  NotFoundException,
  PermissionException,
  ConflictException,
  GoneException,
  WorkflowException,
  SystemException,
  DatabaseException,
  ServiceUnavailableException,
} from './base.exception';

export type { ValidationErrorDetail, ErrorPayload } from './base.exception';
