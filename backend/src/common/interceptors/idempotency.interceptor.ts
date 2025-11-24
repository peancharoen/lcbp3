// File: src/common/interceptors/idempotency.interceptor.ts
// บันทึกการแก้ไข: สร้าง IdempotencyInterceptor เพื่อป้องกันการทำรายการซ้ำ (T1.1)
// บันทึกการแก้ไข: แก้ไข TS18046 โดยการตรวจสอบ Type ของ err ใน catch block

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
import type { Cache } from 'cache-manager';
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

    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    const cachedResponse = await this.cacheManager.get(cacheKey);

    if (cachedResponse) {
      this.logger.warn(
        `Idempotency key detected: ${idempotencyKey}. Returning cached response.`,
      );
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.cacheManager.set(cacheKey, response, 86400 * 1000);
        } catch (err) {
          // ✅ Fix: ตรวจสอบว่า err เป็น Error Object หรือไม่ ก่อนเรียก .stack
          const errorMessage = err instanceof Error ? err.stack : String(err);
          this.logger.error(
            `Failed to cache idempotency key ${idempotencyKey}`,
            errorMessage,
          );
        }
      }),
    );
  }
}
