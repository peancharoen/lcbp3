// File: src/common/exceptions/base.exception.ts
// ADR-007: Exception hierarchy สำหรับ Layered Error Handling

import { HttpException, HttpStatus } from '@nestjs/common';

// ประเภทของ Error ที่ระบบรองรับ
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  BUSINESS_RULE = 'BUSINESS_RULE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // 503 — ระบบไม่พร้อมให้บริการชั่วคราว (Redlock fail, Redis down)
}

// ระดับความรุนแรงของ Error
export enum ErrorSeverity {
  LOW = 'LOW', // ผู้ใช้ทำผิด แก้ไขง่าย
  MEDIUM = 'MEDIUM', // ละเมิดกฎทางธุรกิจ ต้องดำเนินการ
  HIGH = 'HIGH', // ปัญหาระบบ อาจต้องติดต่อ Support
  CRITICAL = 'CRITICAL', // ระบบล้มเหลว ต้องแก้ไขทันที
}

// รายละเอียด Validation Error แต่ละ Field
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

// แปลง ErrorType เป็น HTTP Status Code
export function getStatusCode(type: ErrorType): number {
  switch (type) {
    case ErrorType.VALIDATION:
      return HttpStatus.BAD_REQUEST;
    case ErrorType.BUSINESS_RULE:
      return HttpStatus.UNPROCESSABLE_ENTITY;
    case ErrorType.PERMISSION_DENIED:
      return HttpStatus.FORBIDDEN;
    case ErrorType.NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case ErrorType.CONFLICT:
      return HttpStatus.CONFLICT;
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.DATABASE_ERROR:
    case ErrorType.EXTERNAL_SERVICE:
    case ErrorType.INFRASTRUCTURE:
      return HttpStatus.INTERNAL_SERVER_ERROR;
    case ErrorType.SERVICE_UNAVAILABLE:
      return HttpStatus.SERVICE_UNAVAILABLE; // 503
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

// รูปแบบ Payload ของ Error Response
export interface ErrorPayload {
  type: ErrorType;
  code: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: string;
  recoveryActions?: string[];
  technicalMessage?: string;
  details?: ValidationErrorDetail[] | Record<string, unknown>;
}

// Base Exception ที่ทุก Custom Exception ต้อง extends
export abstract class BaseException extends HttpException {
  public readonly httpStatus: number;

  constructor(
    public readonly type: ErrorType,
    public readonly code: string,
    public readonly technicalMessage: string,
    public readonly userMessage?: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly details?: ValidationErrorDetail[] | Record<string, unknown>,
    public readonly recoveryActions?: string[]
  ) {
    const httpStatus = getStatusCode(type);

    const payload: ErrorPayload = {
      type,
      code,
      message: userMessage || technicalMessage,
      severity,
      timestamp: new Date().toISOString(),
      ...(recoveryActions && { recoveryActions }),
      ...(process.env['NODE_ENV'] !== 'production' && {
        technicalMessage,
        ...(details && { details }),
      }),
    };

    super({ error: payload }, httpStatus);
    this.httpStatus = httpStatus;
  }
}

// Validation Errors (400) - ข้อมูล Input ผิดพลาด
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

// Business Rule Errors (422) - ละเมิดกฎทางธุรกิจ
export class BusinessException extends BaseException {
  constructor(
    code: string,
    message: string,
    userMessage?: string,
    recoveryActions?: string[]
  ) {
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

// Not Found Errors (404) - ไม่พบข้อมูล
export class NotFoundException extends BaseException {
  constructor(resource: string, identifier?: string) {
    super(
      ErrorType.NOT_FOUND,
      'NOT_FOUND',
      `${resource}${identifier ? ` with identifier "${identifier}"` : ''} not found`,
      `ไม่พบ${resource}ที่ค้นหา`,
      ErrorSeverity.LOW,
      undefined,
      ['ตรวจสอบ ID/UUID ที่ระบุ', 'ค้นหาข้อมูลจากรายการ']
    );
  }
}

// Permission Errors (403) - ไม่มีสิทธิ์
export class PermissionException extends BaseException {
  constructor(resource: string, action: string) {
    super(
      ErrorType.PERMISSION_DENIED,
      'PERMISSION_DENIED',
      `User lacks permission for "${action}" on "${resource}"`,
      `คุณไม่มีสิทธิ์ดำเนินการ "${action}" บน "${resource}"`,
      ErrorSeverity.MEDIUM,
      { resource, action },
      ['ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์', 'ลองใช้บัญชีที่มีสิทธิ์']
    );
  }
}

// Conflict Errors (409) - ข้อมูลซ้ำ / ขัดแย้ง
export class ConflictException extends BaseException {
  constructor(
    code: string,
    message: string,
    userMessage?: string,
    recoveryActions?: string[]
  ) {
    super(
      ErrorType.CONFLICT,
      code,
      message,
      userMessage || 'ข้อมูลซ้ำกันหรือขัดแย้งกับข้อมูลที่มีอยู่',
      ErrorSeverity.MEDIUM,
      undefined,
      recoveryActions || ['ตรวจสอบข้อมูลที่มีอยู่', 'แก้ไขข้อมูลที่ขัดแย้ง']
    );
  }
}

// Workflow Errors (422) - ข้อผิดพลาดจาก Workflow Engine
export class WorkflowException extends BaseException {
  constructor(
    code: string,
    message: string,
    userMessage?: string,
    recoveryActions?: string[]
  ) {
    super(
      ErrorType.BUSINESS_RULE,
      code,
      message,
      userMessage || 'ไม่สามารถดำเนินการ Workflow ได้ในสถานะปัจจุบัน',
      ErrorSeverity.MEDIUM,
      undefined,
      recoveryActions || ['ตรวจสอบสถานะเอกสาร', 'ดำเนินการอื่นที่อนุญาต']
    );
  }
}

// System/Infrastructure Errors (500) - ปัญหาระบบ
export class SystemException extends BaseException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorType.INTERNAL_ERROR,
      'INTERNAL_ERROR',
      message,
      'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง',
      ErrorSeverity.HIGH,
      details,
      ['ลองใหม่อีกครั้ง', 'ติดต่อผู้ดูแลระบบหากยังพบปัญหา']
    );
  }
}

// Database Errors (500) - ปัญหาฐานข้อมูล
export class DatabaseException extends BaseException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorType.DATABASE_ERROR,
      'DATABASE_ERROR',
      message,
      'เกิดข้อผิดพลาดของฐานข้อมูล กรุณาลองใหม่ภายหลัง',
      ErrorSeverity.HIGH,
      details,
      ['ลองใหม่ภายหลัง', 'แจ้งผู้ดูแลระบบหากยังพบปัญหา']
    );
  }
}

// Service Unavailable (503) - ระบบไม่พร้อมให้บริการชั่วคราว
// ADR-021 C1: Redlock Fail-closed — retry ครบแล้ว ยัง acquire ไม่ได้
export class ServiceUnavailableException extends BaseException {
  constructor(
    code: string,
    message: string,
    userMessage?: string,
    recoveryActions?: string[]
  ) {
    super(
      ErrorType.SERVICE_UNAVAILABLE,
      code,
      message,
      userMessage || 'ระบบยุ่งชั่วคราว กรุณาลองใหม่ภายหลัง',
      ErrorSeverity.HIGH,
      undefined,
      recoveryActions || [
        'รอสักครู่แล้วลองใหม่',
        'แจ้งผู้ดูแลระบบหากยังพบปัญหา',
      ]
    );
  }
}
