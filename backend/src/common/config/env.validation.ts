// File: src/common/config/env.validation.ts
import Joi from 'joi';

// สร้าง Schema สำหรับตรวจสอบค่า Environment Variables
export const envValidationSchema = Joi.object({
  // 1. Application Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().default(3000),

  // 2. Database Configuration (MariaDB)
  // ห้ามเป็นค่าว่าง (required)
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // 3. Security (JWT)
  // ต้องมีค่า และควรยาวพอ (ตรวจสอบความยาวได้ถ้าระบุ min)
  JWT_SECRET: Joi.string()
    .required()
    .min(32)
    .message('JWT_SECRET must be at least 32 characters long for security.'),
  JWT_EXPIRATION: Joi.string().default('8h'),
  // 4. Redis Configuration (เพิ่มส่วนนี้)
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().required(),
});
