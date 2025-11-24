// File: src/common/config/redis.config.ts
// บันทึกการแก้ไข: สร้าง Config สำหรับ Redis (T0.2)

import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'cache', // Default เป็นชื่อ Service ใน Docker
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  ttl: parseInt(process.env.REDIS_TTL, 10) || 3600, // Default TTL 1 ชั่วโมง
  // password: process.env.REDIS_PASSWORD, // เปิดใช้ถ้ามี Password
}));
