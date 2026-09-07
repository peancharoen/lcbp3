// File: src/common/common.module.ts
// บันทึกการแก้ไข: Module รวม Infrastructure พื้นฐาน (T1.1)

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AiModule } from '../modules/ai/ai.module';
import { CryptoService } from './services/crypto.service';
import { RequestContextService } from './services/request-context.service';
import { UuidResolverService } from './services/uuid-resolver.service';
import {
  DocumentSideEffectsService,
  DOCUMENT_SIDE_EFFECTS_QUEUE,
} from './services/document-side-effects.service';
import { DocumentHardDeleteService } from './services/document-hard-delete.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
// import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor'; // นำเข้าถ้าต้องการใช้ Global

@Global() // ทำให้ Module นี้ใช้ได้ทั่วทั้งแอปโดยไม่ต้อง Import ซ้ำ
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    AiModule,
    BullModule.registerQueue({ name: DOCUMENT_SIDE_EFFECTS_QUEUE }),
  ],
  providers: [
    CryptoService,
    RequestContextService,
    UuidResolverService,
    DocumentSideEffectsService,
    DocumentHardDeleteService,
    // Register Global Filter & Interceptor ที่นี่ หรือใน AppModule ก็ได้
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
  exports: [
    CryptoService,
    RequestContextService,
    UuidResolverService,
    DocumentSideEffectsService,
    DocumentHardDeleteService,
  ],
})
export class CommonModule {}
