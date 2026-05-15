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

  // 5. AI Gateway Configuration (ADR-023)
  // URL หลักของเครื่อง AI Host (Desk-5439)
  AI_HOST_URL: Joi.string().uri().optional(),
  // URL ของ Qdrant บนเครื่อง AI Host
  AI_QDRANT_URL: Joi.string().uri().optional(),
  // Token สำหรับ n8n Service Account ตาม ADR-023
  AI_N8N_SERVICE_TOKEN: Joi.string().optional(),
  // URL ของ n8n Webhook สำหรับส่งเอกสารไปประมวลผล
  AI_N8N_WEBHOOK_URL: Joi.string().uri().optional(),
  // Legacy alias: ใช้ AI_N8N_SERVICE_TOKEN สำหรับงานใหม่
  AI_N8N_AUTH_TOKEN: Joi.string().optional(),
  // URL ของ Ollama บน Admin Desktop (Desk-5439)
  AI_OLLAMA_URL: Joi.string().uri().optional(),
  // Timeout สำหรับการรอผลลัพธ์จาก AI (milliseconds)
  AI_TIMEOUT_MS: Joi.number().default(30000),
  // จำนวนครั้งสูงสุดในการ Retry เมื่อ AI ล้มเหลว
  AI_MAX_RETRIES: Joi.number().default(3),
  // Base URL ของ Backend เพื่อสร้าง Callback URL
  APP_BASE_URL: Joi.string().uri().optional(),
});
