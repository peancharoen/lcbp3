// File: src/modules/ai/tool/types/tool-handler-context.type.ts
// Change Log
// - 2026-05-19: สร้าง ToolHandlerContext สำหรับส่ง context ไปยัง Tool Handlers (ADR-025).

import { User } from '../../../user/entities/user.entity';

/**
 * Context ที่ส่งไปยัง Tool Handler ทุกตัว
 * ใช้สำหรับ CASL authorization และ query filtering
 */
export interface ToolHandlerContext {
  /** User ที่ร้องขอ — ใช้สำหรับ CASL check */
  requestUser: User;
  /** UUID ของ Project ที่ต้องการดึงข้อมูล (ADR-023A: mandatory for Qdrant isolation) */
  projectPublicId: string;
  /** Parameters เพิ่มเติม (เช่น statusCode, limit, search) */
  params?: Record<string, unknown>;
}
