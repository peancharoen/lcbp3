// File: src/common/common.module.ts
// บันทึกการแก้ไข: Module รวม Infrastructure พื้นฐาน (T1.1)

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './services/crypto.service';
import { RequestContextService } from './services/request-context.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
// import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor'; // นำเข้าถ้าต้องการใช้ Global

@Global() // ทำให้ Module นี้ใช้ได้ทั่วทั้งแอปโดยไม่ต้อง Import ซ้ำ
@Module({
  imports: [ConfigModule],
  providers: [
    CryptoService,
    RequestContextService,
    // Register Global Filter & Interceptor ที่นี่ หรือใน AppModule ก็ได้
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
  exports: [CryptoService, RequestContextService],
})
export class CommonModule {}
