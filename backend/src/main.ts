// File: src/main.ts
// บันทึกการแก้ไข: ปรับปรุง main.ts ให้สมบูรณ์ เชื่อมต่อกับ Global Filters/Interceptors และ ConfigService (T1.1)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  // 1. Create App
  const app = await NestFactory.create(AppModule);

  // ดึง ConfigService เพื่อใช้ดึงค่า Environment Variables
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 🛡️ 2. Security (Helmet & CORS)
  // ปรับ CSP ให้รองรับ Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ตั้งค่า CORS — แยก CORS_ORIGIN ด้วย comma เป็น array เพื่อให้ NestJS
  // ส่งเฉพาะ origin ที่ match กับ request กลับไป (ไม่ใช่ comma-separated string ทั้งก้อน)
  const corsOriginRaw = configService.get<string>('CORS_ORIGIN');
  const corsOrigin = corsOriginRaw
    ? corsOriginRaw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : true;
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 📁 3. Body Parser Limits (รองรับ File Upload 50MB ตาม Requirements)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 🌐 4. Global Prefix (ยกเว้น /health, /metrics, /ping สำหรับ monitoring)
  // SEV-013: /ping = public health endpoint (load balancer, Docker HEALTHCHECK, deploy.sh)
  //          /health = auth-required infra detail (ต้องมี JWT)
  app.setGlobalPrefix('api', {
    exclude: ['health', 'metrics', 'ping'],
  });

  // ⚙️ 5. Global Pipes & Interceptors & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ส่วนเกินทิ้ง (Security)
      transform: true, // แปลง Type อัตโนมัติ (เช่น string -> number)
      forbidNonWhitelisted: true, // แจ้ง Error ถ้าส่ง field แปลกปลอมมา
      transformOptions: {
        enableImplicitConversion: true, // ช่วยแปลง Type ใน Query Params
      },
    })
  );

  // ⚠️ TransformInterceptor & HttpExceptionFilter ลงทะเบียนผ่าน APP_INTERCEPTOR/APP_FILTER ใน CommonModule แล้ว
  // ห้ามลงทะเบียนซ้ำที่นี่ เพราะจะทำให้ Response ถูก wrap ซ้อน 2 ชั้น

  // 📘 6. Swagger Configuration (SEV-011: non-production หรือเปิด SWAGGER_ENABLED)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED', 'false');
  if (nodeEnv !== 'production' || swaggerEnabled === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LCBP3 DMS API')
      .setDescription('Document Management System API Documentation')
      .setVersion('1.8.1')
      .addBearerAuth() // เพิ่มปุ่มใส่ Token (รูปกุญแจ)
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // ตั้งค่าให้เข้าถึง Swagger ได้ที่ /docs
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // จำ Token ไว้ไม่ต้องใส่ใหม่เวลารีเฟรชหน้าจอ
      },
    });
  } else {
    logger.log('Swagger UI disabled in production (NODE_ENV=production)');
  }

  // 🚀 7. Start Server
  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on: ${await app.getUrl()}/api`);
}
void bootstrap();
