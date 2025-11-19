import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js'; // อย่าลืม .js ถ้าใช้ ESM
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Global Prefix (เช่น /api/v1)
  app.setGlobalPrefix('api');

  // 2. Global Validation Pipe (ตรวจสอบ Input DTO)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ส่วนเกินทิ้ง
      transform: true, // แปลง Type อัตโนมัติ (เช่น string -> number)
      forbidNonWhitelisted: true, // แจ้ง Error ถ้าส่ง field แปลกปลอมมา
    }),
  );

  // 3. Global Interceptor (จัด Format Response)
  app.useGlobalInterceptors(new TransformInterceptor());

  // 4. Global Exception Filter (จัดการ Error)
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
