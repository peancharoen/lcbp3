// File: src/common/config/redis.config.ts
// บันทึกการแก้ไข: สร้าง Config สำหรับ Redis (T0.2)
// บันทึกการแก้ไข: แก้ไข TS2345 โดยการจัดการค่า undefined ของ process.env ก่อน parseInt

import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  // ใช้ค่า Default 'cache' ถ้าหาไม่เจอ
  host: process.env.REDIS_HOST || 'cache',
  // ✅ Fix: ใช้ || '6379' เพื่อให้มั่นใจว่าเป็น string ก่อนเข้า parseInt
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  // ✅ Fix: ใช้ || '3600' เพื่อให้มั่นใจว่าเป็น string
  ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  // password: process.env.REDIS_PASSWORD,
}));
