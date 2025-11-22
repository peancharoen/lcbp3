import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // ✅ เพิ่ม Import Swagger
import { json, urlencoded } from 'express'; // ✅ เพิ่ม Import Body Parser
import helmet from 'helmet';

// Import ของเดิมของคุณ
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 🛡️ 1. Security (Helmet & CORS)
  app.use(helmet());
  app.enableCors({
    origin: true, // หรือระบุเช่น ['https://lcbp3.np-dms.work']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 📁 2. Body Parser Limits (รองรับ File Upload 50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 🌐 3. Global Prefix (เช่น /api/v1)
  app.setGlobalPrefix('api');

  // ⚙️ 4. Global Pipes & Interceptors (ของเดิม)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ส่วนเกินทิ้ง
      transform: true, // แปลง Type อัตโนมัติ (เช่น string -> number)
      forbidNonWhitelisted: true, // แจ้ง Error ถ้าส่ง field แปลกปลอมมา
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 📘 5. Swagger Configuration (ส่วนที่ขาดไป)
  const config = new DocumentBuilder()
    .setTitle('LCBP3 DMS API')
    .setDescription('Document Management System API Documentation')
    .setVersion('1.4.3')
    .addBearerAuth() // เพิ่มปุ่มใส่ Token (รูปกุญแจ)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ตั้งค่าให้เข้าถึงได้ที่ /docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // จำ Token ไว้ไม่ต้องใส่ใหม่เวลารีเฟรช
    },
  });

  // 🚀 6. Start Server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log(`Swagger UI is available at: http://localhost:${port}/docs`);
}
bootstrap();
