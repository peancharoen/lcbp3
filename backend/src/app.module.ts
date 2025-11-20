// File: src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core'; // <--- เพิ่ม Import นี้ T2.4
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq'; // Import BullModule
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // <--- เพิ่ม Import นี้ T2.4
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js'; // สังเกต .js สำหรับ ESM
// import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { DocumentNumberingModule } from './modules/document-numbering/document-numbering.module';
import { AuthModule } from './common/auth/auth.module.js'; // <--- เพิ่ม Import นี้ T2.4
import { JsonSchemaModule } from './modules/json-schema/json-schema.module.js';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module';
@Module({
  imports: [
    // 1. Setup Config Module พร้อม Validation
    ConfigModule.forRoot({
      isGlobal: true, // เรียกใช้ได้ทั่วทั้ง App ไม่ต้อง import ซ้ำ
      envFilePath: '.env', // อ่านไฟล์ .env (สำหรับ Dev)
      validationSchema: envValidationSchema, // ใช้ Schema ที่เราสร้างเพื่อตรวจสอบ
      validationOptions: {
        // ถ้ามีค่าไหนไม่ผ่าน Validation ให้ Error และหยุดทำงานทันที
        abortEarly: true,
      },
    }),
    // 🛡️ T2.4 1. Setup Throttler Module (Rate Limiting)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 วินาที (Time to Live)
        limit: 100, // ยิงได้สูงสุด 100 ครั้ง (Global Default)
      },
    ]),

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
        // synchronize: true เฉพาะตอน Dev เท่านั้น ห้ามใช้บน Prod
        // synchronize: configService.get<string>('NODE_ENV') === 'development',
        // แก้บรรทัดนี้เป็น false ครับ
        // เพราะเราใช้ SQL Script สร้าง DB แล้ว ไม่ต้องการให้ TypeORM มาแก้ Structure อัตโนมัติ
        synchronize: false, // เราใช้ false ตามที่ตกลงกัน
      }),
    }),

    // 3. BullMQ (Redis) Setup [NEW]
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
    AuthModule,
    // CommonModule,
    UserModule,
    ProjectModule,
    FileStorageModule,
    DocumentNumberingModule,
    JsonSchemaModule,
    WorkflowEngineModule,
    CorrespondenceModule, // <--- เพิ่ม
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🛡️ 2. Register Global Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
