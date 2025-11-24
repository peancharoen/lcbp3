// File: src/common/exceptions/http-exception.filter.ts
// บันทึกการแก้ไข: ปรับปรุง Global Filter ให้จัดการ Error ปลอดภัยสำหรับ Production และ Log ละเอียดใน Dev (T1.1)

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
    let errorBody: any =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : exceptionResponse;

    // 3. 📝 Logging Strategy (แยกตามความรุนแรง)
    if (status >= 500) {
      // 💥 Critical Error: Log stack trace เต็มๆ
      this.logger.error(
        `💥 HTTP ${status} Error on ${request.method} ${request.url}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
      );

      // 👇👇 สิ่งที่คุณต้องการ: Log ดิบๆ ให้เห็นชัดใน Docker Console 👇👇
      console.error('💥 REAL CRITICAL ERROR:', exception);
    } else {
      // ⚠️ Client Error (400, 401, 403, 404): Log แค่ Warning พอ ไม่ต้อง Stack Trace
      this.logger.warn(
        `⚠️ HTTP ${status} Error on ${request.method} ${request.url}: ${JSON.stringify(errorBody.message || errorBody)}`,
      );
    }

    // 4. 🔒 Security & Response Formatting
    // กรณี Production และเป็น Error 500 -> ต้องซ่อนรายละเอียดความผิดพลาดของ Server
    if (status === 500 && process.env.NODE_ENV === 'production') {
      errorBody = {
        message: 'Internal server error',
        // อาจเพิ่ม reference code เพื่อให้ user แจ้ง support ได้ เช่น code: 'ERR-500'
      };
    }

    // 5. Construct Final Response
    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...errorBody, // Spread message, error, validation details
    };

    // 🛠️ Development Mode: แถม Stack Trace ไปให้ Frontend Debug ง่ายขึ้น
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      responseBody.stack = exception.stack;
    }

    response.status(status).json(responseBody);
  }
}
