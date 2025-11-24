// File: src/common/interceptors/idempotency.interceptor.ts
// บันทึกการแก้ไข: สร้าง IdempotencyInterceptor เพื่อป้องกันการทำรายการซ้ำ (T1.1)

import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // 1. ตรวจสอบว่าควรใช้ Idempotency หรือไม่ (เฉพาะ POST, PUT, DELETE)
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    // 2. ดึง Idempotency-Key จาก Header
    const idempotencyKey = request.headers['idempotency-key'] as string;

    // ถ้าไม่มี Key ส่งมา ให้ทำงานปกติ (หรือจะบังคับให้ Error ก็ได้ ตาม Policy)
    if (!idempotencyKey) {
      // หมายเหตุ: ในระบบที่ Strict อาจจะ throw BadRequestException ถ้าไม่มี Key สำหรับ Transaction สำคัญ
      return next.handle();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    // 3. ตรวจสอบใน Redis ว่า Key นี้เคยถูกประมวลผลหรือยัง
    const cachedResponse = await this.cacheManager.get(cacheKey);

    if (cachedResponse) {
      this.logger.warn(
        `Idempotency key detected: ${idempotencyKey}. Returning cached response.`,
      );
      // ถ้ามี ให้คืนค่าเดิมกลับไปเลย (เสมือนว่าทำรายการสำเร็จแล้ว)
      return of(cachedResponse);
    }

    // 4. ถ้ายังไม่มี ให้ประมวลผลต่อ และบันทึกผลลัพธ์ลง Redis
    return next.handle().pipe(
      tap(async (response) => {
        try {
          // บันทึก Response ลง Cache (TTL 24 ชั่วโมง หรือตามความเหมาะสม)
          await this.cacheManager.set(cacheKey, response, 86400 * 1000);
        } catch (err) {
          this.logger.error(
            `Failed to cache idempotency key ${idempotencyKey}`,
            err.stack,
          );
        }
      }),
    );
  }
}
