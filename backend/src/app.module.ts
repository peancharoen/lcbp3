// File: src/app.module.ts
// บันทึกการแก้ไข: เพิ่ม CacheModule (Redis), Config สำหรับ Idempotency และ Maintenance Mode (T1.1)

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js';
import redisConfig from './common/config/redis.config';

// Entities & Interceptors
import { AuditLog } from './common/entities/audit-log.entity';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
// ✅ Import Guard ใหม่สำหรับ Maintenance Mode
import { MaintenanceModeGuard } from './common/guards/maintenance-mode.guard';
// import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor'; // ✅ เตรียมไว้ใช้ (ถ้าต้องการ Global)

// Modules
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { FileStorageModule } from './common/file-storage/file-storage.module.js';
import { DocumentNumberingModule } from './modules/document-numbering/document-numbering.module';
import { AuthModule } from './common/auth/auth.module.js';
import { JsonSchemaModule } from './modules/json-schema/json-schema.module.js';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module';

@Module({
  imports: [
    // 1. Setup Config Module พร้อม Validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [redisConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // 🛡️ Setup Throttler Module (Rate Limiting)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 วินาที
        limit: 100, // ยิงได้สูงสุด 100 ครั้ง
      },
    ]),

    // 💾 Setup Cache Module (Redis)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
          },
          ttl: configService.get<number>('redis.ttl'),
        }),
      }),
      inject: [ConfigService],
    }),

    // 2. Setup TypeORM (MariaDB)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false, // Production Ready: false
      }),
    }),

    // ✅ 4. Register AuditLog Entity (Global Scope)
    TypeOrmModule.forFeature([AuditLog]),

    // 3. BullMQ (Redis) Setup
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // Feature Modules
    AuthModule,
    UserModule,
    ProjectModule,
    FileStorageModule,
    DocumentNumberingModule,
    JsonSchemaModule,
    WorkflowEngineModule,
    CorrespondenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🛡️ 1. Register Global Guard (Rate Limit) - ทำงานก่อนเพื่อน
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 🚧 2. Maintenance Mode Guard - ทำงานต่อมา เพื่อ Block การเข้าถึงถ้าระบบปิดอยู่
    {
      provide: APP_GUARD,
      useClass: MaintenanceModeGuard,
    },
    // 📝 3. Register Global Interceptor (Audit Log)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    // 🔄 4. Register Idempotency (Uncomment เมื่อต้องการบังคับใช้ Global)
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: IdempotencyInterceptor,
    // },
  ],
})
export class AppModule {}

/*วิธีใช้งาน
เมื่อต้องการเปิด Maintenance Mode ให้ Admin (หรือคุณ) ยิงคำสั่งเข้า Redis หรือสร้าง API เพื่อ Set ค่า: SET system:maintenance_mode true (หรือ "true")

ระบบจะตอบกลับด้วย 503 Service Unavailable ทันที ยกเว้น Controller ที่คุณใส่ @BypassMaintenance() ไว้ครับ
*/
