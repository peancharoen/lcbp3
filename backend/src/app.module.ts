// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. Load Config Module
    ConfigModule.forRoot({
      isGlobal: true, // ให้เรียกใช้ได้ทุกที่โดยไม่ต้อง import ใหม่
      envFilePath: '.env', // อ่านค่าจากไฟล์ .env
    }),

    // 2. Setup TypeORM Connection (Async เพื่อรออ่าน Config ก่อน)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb', // หรือ 'mysql' ก็ได้เพราะใช้ driver เดียวกัน
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        // Auto Load Entities: โหลด Entity ทั้งหมดที่อยู่ในโปรเจกต์อัตโนมัติ
        autoLoadEntities: true,
        // Synchronize: true เฉพาะ Dev environment (ห้ามใช้ใน Prod)
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        // Logging: เปิดดู Query SQL ตอน Dev
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}