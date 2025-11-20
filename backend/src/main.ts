import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js'; // อย่าลืม .js ถ้าใช้ ESM
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter.js';
import helmet from 'helmet'; // <--- Import Helmet

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 🛡️ 1. เปิดใช้งาน Helmet (Security Headers)
  app.use(helmet());

  // 🛡️ 2. เปิดใช้งาน CORS (เพื่อให้ Frontend จากโดเมนอื่นเรียกใช้ได้)
  // ใน Production ควรระบุ origin ให้ชัดเจน แทนที่จะเป็น *
  app.enableCors({
    origin: true, // หรือระบุเช่น ['https://lcbp3.np-dms.work']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
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
