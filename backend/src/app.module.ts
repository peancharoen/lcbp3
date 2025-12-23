// File: src/app.module.ts
// บันทึกการแก้ไข: เพิ่ม CacheModule (Redis), Config สำหรับ Idempotency และ Maintenance Mode (T1.1)
// บันทึกการแก้ไข: เพิ่ม MonitoringModule และ WinstonModule (T6.3)
// เพิ่ม MasterModule

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { WinstonModule } from 'nest-winston';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisModule } from '@nestjs-modules/ioredis';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js';
import redisConfig from './common/config/redis.config';
import { winstonConfig } from './modules/monitoring/logger/winston.config';

// Entities & Interceptors
import { AuditLog } from './common/entities/audit-log.entity';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { MaintenanceModeGuard } from './common/guards/maintenance-mode.guard';

// Modules
import { AuthModule } from './common/auth/auth.module.js';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ContractModule } from './modules/contract/contract.module';
import { MasterModule } from './modules/master/master.module'; // [NEW] ✅ เพิ่ม MasterModule
import { FileStorageModule } from './common/file-storage/file-storage.module.js';
import { DocumentNumberingModule } from './modules/document-numbering/document-numbering.module';
import { JsonSchemaModule } from './modules/json-schema/json-schema.module.js';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module';
import { RfaModule } from './modules/rfa/rfa.module';
import { DrawingModule } from './modules/drawing/drawing.module';
import { TransmittalModule } from './modules/transmittal/transmittal.module';
import { CirculationModule } from './modules/circulation/circulation.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { ResilienceModule } from './common/resilience/resilience.module';
import { SearchModule } from './modules/search/search.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';

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

    // 📝 Setup Winston Logger
    WinstonModule.forRoot(winstonConfig),

    // 2. Setup TypeORM (MariaDB)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
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

    // Register AuditLog Entity (Global Scope)
    TypeOrmModule.forFeature([AuditLog]),

    // 3. BullMQ (Redis) Setup
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // Setup Redis Module (for InjectRedis)
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
        options: {
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // 📊 Monitoring & Resilience
    MonitoringModule,
    ResilienceModule,

    // 📦 Feature Modules
    AuthModule,
    UserModule,
    ProjectModule,
    OrganizationModule,
    ContractModule,
    MasterModule, // ✅ [NEW] Register MasterModule here
    FileStorageModule,
    DocumentNumberingModule,
    JsonSchemaModule,
    WorkflowEngineModule,
    CorrespondenceModule,
    RfaModule,
    DrawingModule,
    TransmittalModule,
    CirculationModule,
    SearchModule,
    NotificationModule,
    DashboardModule,
    AuditLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🛡️ 1. Register Global Guard (Rate Limit)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 🚧 2. Maintenance Mode Guard
    {
      provide: APP_GUARD,
      useClass: MaintenanceModeGuard,
    },
    // 📝 3. Register Global Interceptor (Audit Log)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
