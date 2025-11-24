// File: src/main.ts
// บันทึกการแก้ไข: ปรับปรุง main.ts ให้สมบูรณ์ เชื่อมต่อกับ Global Filters/Interceptors และ ConfigService (T1.1)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

// Import Custom Interceptors & Filters ที่สร้างใน T1.1
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';

async function bootstrap() {
  // 1. Create App
  const app = await NestFactory.create(AppModule);

  // ดึง ConfigService เพื่อใช้ดึงค่า Environment Variables
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 🛡️ 2. Security (Helmet & CORS)
  app.use(helmet());

  // ตั้งค่า CORS (ใน Production ควรระบุ origin ให้ชัดเจนจาก Config)
  app.enableCors({
    origin: true, // หรือ configService.get('CORS_ORIGIN')
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 📁 3. Body Parser Limits (รองรับ File Upload 50MB ตาม Requirements)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 🌐 4. Global Prefix
  app.setGlobalPrefix('api');

  // ⚙️ 5. Global Pipes & Interceptors & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ส่วนเกินทิ้ง (Security)
      transform: true, // แปลง Type อัตโนมัติ (เช่น string -> number)
      forbidNonWhitelisted: true, // แจ้ง Error ถ้าส่ง field แปลกปลอมมา
      transformOptions: {
        enableImplicitConversion: true, // ช่วยแปลง Type ใน Query Params
      },
    }),
  );

  // ลงทะเบียน Global Interceptor และ Filter ที่เราสร้างไว้
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 📘 6. Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LCBP3 DMS API')
    .setDescription('Document Management System API Documentation')
    .setVersion('1.4.3')
    .addBearerAuth() // เพิ่มปุ่มใส่ Token (รูปกุญแจ)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // ตั้งค่าให้เข้าถึง Swagger ได้ที่ /docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // จำ Token ไว้ไม่ต้องใส่ใหม่เวลารีเฟรชหน้าจอ
    },
  });

  // 🚀 7. Start Server
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  logger.log(`Application is running on: ${await app.getUrl()}/api`);
  logger.log(`Swagger UI is available at: ${await app.getUrl()}/docs`);
}
bootstrap();
