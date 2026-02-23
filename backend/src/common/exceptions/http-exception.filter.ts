// File: src/common/exceptions/http-exception.filter.ts
// Fix #3 & #4: แทน console.error ด้วย Logger, เพิ่ม ErrorResponseBody interface

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message?: unknown;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. หา Status Code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. หา Error Response Body ต้นฉบับ
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    // จัดรูปแบบ Error Message ให้เป็น Object เสมอ
    let errorBody: Record<string, unknown> =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

    // 3. 📝 Logging Strategy (แยกตามความรุนแรง)
    if (status >= 500) {
      // 💥 Critical Error: Log stack trace เต็มๆ
      this.logger.error(
        `HTTP ${status} Error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception)
      );
    } else {
      // ⚠️ Client Error (400, 401, 403, 404): Log แค่ Warning พอ ไม่ต้อง Stack Trace
      this.logger.warn(
        `HTTP ${status} Error on ${request.method} ${request.url}: ${JSON.stringify(errorBody['message'] ?? errorBody)}`
      );
    }

    // 4. 🔒 Security & Response Formatting
    // กรณี Production และเป็น Error 500 -> ต้องซ่อนรายละเอียดความผิดพลาดของ Server
    if (status === 500 && process.env['NODE_ENV'] === 'production') {
      errorBody = {
        message: 'Internal server error',
      };
    }

    // 5. Construct Final Response (type-safe)
    const responseBody: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...errorBody,
    };

    // 🛠️ Development Mode: แถม Stack Trace ไปให้ Frontend Debug ง่ายขึ้น
    if (
      process.env['NODE_ENV'] !== 'production' &&
      exception instanceof Error
    ) {
      responseBody.stack = exception.stack;
    }

    response.status(status).json(responseBody);
  }
}
