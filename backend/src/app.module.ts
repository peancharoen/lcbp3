// File: src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq'; // Import BullModule
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js'; // สังเกต .js สำหรับ ESM
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';

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
        synchronize: false,
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

    CommonModule,

    UserModule,

    ProjectModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
