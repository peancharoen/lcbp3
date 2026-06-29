// File: src/common/filters/global-exception.filter.ts
// ADR-007: Global Exception Filter พร้อม Layered Error Processing

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import {
  BaseException,
  ErrorType,
  ErrorSeverity,
  ErrorPayload,
} from '../exceptions/base.exception';

// รูปแบบ Error Response ที่ส่งกลับ Client
interface ErrorResponse {
  error: ErrorPayload & { statusCode: number };
}

// ข้อมูล Log สำหรับ Error
interface ErrorLogData {
  path: string;
  method: string;
  userId?: number;
  ip: string;
  userAgent: string;
  exception: {
    name: string;
    message: string;
    stack?: string;
    details?: unknown;
  };
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithUser>();

    let errorResponse: ErrorResponse;
    let httpStatus: number;

    if (exception instanceof BaseException) {
      // จัดการ Custom Exception ของเรา (ADR-007)
      const payload = exception.getResponse() as { error: ErrorPayload };
      httpStatus = exception.httpStatus;
      errorResponse = {
        error: {
          ...payload.error,
          statusCode: httpStatus,
        },
      };
      this.logError(
        exception,
        request,
        exception.severity === ErrorSeverity.CRITICAL
      );
    } else if (exception instanceof HttpException) {
      // จัดการ NestJS Built-in Exceptions
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // แปลง NestJS exception response เป็น user-friendly message
      let technicalDetail: unknown = exceptionResponse;
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        technicalDetail = exceptionResponse;
      }

      errorResponse = {
        error: {
          type: this.mapStatusToErrorType(httpStatus),
          code: 'HTTP_ERROR',
          message: this.mapStatusToUserMessage(httpStatus),
          severity:
            httpStatus >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
          timestamp: new Date().toISOString(),
          statusCode: httpStatus,
          recoveryActions: this.mapStatusToRecoveryActions(httpStatus),
          ...(process.env['NODE_ENV'] !== 'production' && {
            technicalMessage: exception.message,
            details: technicalDetail as Record<string, unknown>,
          }),
        },
      };
      this.logError(exception, request, httpStatus >= 500);
    } else {
      // จัดการ Unexpected Errors (ไม่รู้ประเภท)
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: {
          type: ErrorType.INTERNAL_ERROR,
          code: 'UNEXPECTED_ERROR',
          message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่ภายหลัง',
          severity: ErrorSeverity.CRITICAL,
          timestamp: new Date().toISOString(),
          statusCode: httpStatus,
          recoveryActions: [
            'ลองใหม่อีกครั้ง',
            'ติดต่อผู้ดูแลระบบหากยังพบปัญหา',
          ],
        },
      };
      this.logError(exception, request, true);
    }

    response.status(httpStatus).json(errorResponse);
  }

  // Logging แยกตามความรุนแรง
  private logError(
    exception: unknown,
    request: RequestWithUser,
    isCritical: boolean
  ): void {
    const err =
      exception instanceof Error ? exception : new Error(String(exception));

    const logData: ErrorLogData = {
      path: request.url,
      method: request.method,
      userId: request.user?.user_id,
      ip: request.ip ?? 'unknown',
      userAgent: (request.headers['user-agent'] as string) ?? 'unknown',
      exception: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        details:
          exception instanceof BaseException ? exception.details : undefined,
      },
    };

    if (isCritical) {
      this.logger.error('Critical error occurred', JSON.stringify(logData));
    } else {
      this.logger.warn('Error occurred', JSON.stringify(logData));
    }
  }

  // แปลง HTTP Status เป็น ErrorType
  private mapStatusToErrorType(status: number): ErrorType {
    switch (status) {
      case 400:
        return ErrorType.VALIDATION;
      case 401:
      case 403:
        return ErrorType.PERMISSION_DENIED;
      case 404:
        return ErrorType.NOT_FOUND;
      case 409:
        return ErrorType.CONFLICT;
      case 422:
        return ErrorType.BUSINESS_RULE;
      default:
        return ErrorType.INTERNAL_ERROR;
    }
  }

  // แปลง HTTP Status เป็น User-friendly Message (ภาษาไทย)
  private mapStatusToUserMessage(status: number): string {
    switch (status) {
      case 400:
        return 'ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่';
      case 401:
        return 'กรุณาเข้าสู่ระบบก่อนใช้งาน';
      case 403:
        return 'คุณไม่มีสิทธิ์ในการดำเนินการนี้';
      case 404:
        return 'ไม่พบข้อมูลที่ร้องขอ';
      case 409:
        return 'ข้อมูลซ้ำกันหรือมีความขัดแย้ง';
      case 422:
        return 'ไม่สามารถดำเนินการได้เนื่องจากเงื่อนไขทางธุรกิจ';
      case 429:
        return 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
      default:
        return 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง';
    }
  }

  // Recovery Actions สำหรับแต่ละ HTTP Status
  private mapStatusToRecoveryActions(status: number): string[] {
    switch (status) {
      case 400:
        return [
          'ตรวจสอบข้อมูลที่กรอก',
          'แก้ไขข้อมูลที่ผิดพลาด',
          'ลองใหม่อีกครั้ง',
        ];
      case 401:
        return ['เข้าสู่ระบบ', 'ตรวจสอบ Session ที่หมดอายุ'];
      case 403:
        return ['ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์', 'ลองใช้บัญชีที่มีสิทธิ์'];
      case 404:
        return ['ตรวจสอบ ID/UUID ที่ระบุ', 'ค้นหาข้อมูลจากรายการ'];
      case 409:
        return ['ตรวจสอบข้อมูลที่มีอยู่', 'แก้ไขข้อมูลที่ขัดแย้ง'];
      case 429:
        return ['รอสักครู่แล้วลองใหม่'];
      default:
        return ['ลองใหม่อีกครั้ง', 'ติดต่อผู้ดูแลระบบหากยังพบปัญหา'];
    }
  }
}
