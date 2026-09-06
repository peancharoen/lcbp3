// File: backend/src/modules/migration/dto/excel-import-review.dto.ts
// Change Log:
// - 2026-09-05: Initial creation — DTOs สำหรับ 4-Layer Excel Data Review Pipeline
//   (Feature 252, ADR-052, T001, FR-001/FR-008/FR-014/FR-016)
// - 2026-09-05: Fix Cycle 1 (review BLOCKED → fixed) — เพิ่ม @Transform บน
//   `aiProvider` เพื่อบังคับ default LOCAL_OLLAMA ใน path จริงของ global
//   ValidationPipe ใน main.ts (transform: true + enableImplicitConversion:
//   true โดยไม่มี exposeDefaultValues) เพราะ payload ที่มี key นี้เป็น ''
//   (ฟอร์ม multipart ส่ง field ว่าง) หรือ null (JSON) จะเขียนทับ class
//   field initializer และถูก @IsIn reject — พร้อมใช้ type aliases
//   ReviewTargetMode/AiReviewerProvider จาก excel-review.types.ts แทน
//   inline unions (FR-008, D2)
// - 2026-09-06: Fix Wave 3 review — ลบ `file` field ออกจาก DTO เพราะ
//   controller ใช้ @Query() สำหรับ DTO แต่ไฟล์มาทาง @UploadedFile()
//   (multipart) — การมี field นี้ใน query DTO ทำให้ global ValidationPipe
//   reject ทุก request เพราะ query ไม่มีทางมี multipart file ได้
//   การ validate ไฟล์ (whitelist นามสกุล, size limit) จัดการใน interceptor
// - 2026-09-06: Code review fix — ลบ ConfirmImportReviewDto และ
//   CancelImportReviewDto ที่ไม่ถูกใช้ (controller ใช้ @Param + ParseUUIDPipe
//   แทน @Body DTO)
// - 2026-09-06: เพิ่ม batchStrategy field สำหรับ Q3 Batching Strategy
//   (FULL = default ≤200 rows, FAST_SELECTIVE = WARN + 5% sample >200 rows)

import { IsUUID, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ReviewTargetMode,
  AiReviewerProvider,
  BatchStrategy,
} from '../types/excel-review.types';

/**
 * DTO สำหรับ `POST /api/v1/correspondence/import-review/check` (FR-001)
 *
 * การส่งค่าตาม contracts/import-review-api.yaml:
 * - `projectPublicId` / `targetMode` / `aiProvider` ส่งเป็น query parameters
 * - `file` ส่งเป็น multipart/form-data body (จัดการโดย @UploadedFile +
 *   FileInterceptor ใน controller — ไม่อยู่ใน query DTO)
 *
 * หมายเหตุ: Identifier ทุกตัวเป็น UUID string ตาม ADR-019
 * (ห้าม parseInt/Number/+ และห้าม expose INT id)
 */
export class CheckImportReviewDto {
  @ApiProperty({
    description:
      'UUIDv7 publicId ของโครงการปลายทาง (บังคับ 1 ไฟล์ต่อ 1 โครงการ, D14)',
    format: 'uuid',
  })
  @IsUUID()
  projectPublicId!: string;

  @ApiProperty({
    description:
      'โหมดปลายทาง: MIGRATION_STAGING = เข้า Staging Queue (Admin เท่านั้น), ' +
      'DIRECT_IMPORT = บันทึกตรงแบบ All-or-Nothing (D1, FR-015)',
    enum: ['MIGRATION_STAGING', 'DIRECT_IMPORT'],
  })
  @IsIn(['MIGRATION_STAGING', 'DIRECT_IMPORT'])
  targetMode!: ReviewTargetMode;

  /**
   * ผู้ให้บริการ AI Reviewer ของ Layer 3 (D2, FR-008)
   *
   * Fix Cycle 1: ใช้ @Transform บังคับ default แทนการพึ่ง class field
   * initializer เพียงอย่างเดียว เพราะ global ValidationPipe ใน main.ts
   * (transform: true + enableImplicitConversion: true) ไม่มี
   * exposeDefaultValues — payload ที่มี key นี้เป็น '' (ฟอร์ม multipart
   * ส่ง field ว่าง) หรือ null (JSON) จะเขียนทับ initializer และถูก
   * @IsIn reject ทันที จึงต้องปรับค่าเป็น LOCAL_OLLAMA ที่ตัว transform
   * (คง class field initializer ไว้เป็น default สำหรับ `new` ตรง ๆ)
   */
  @ApiPropertyOptional({
    description:
      'ผู้ให้บริการ AI Reviewer ของ Layer 3 (D2) — ไม่ส่ง = LOCAL_OLLAMA ' +
      '(คลาวด์ GEMINI/CLAUDE ต้องมีสิทธิ์ Admin + ALLOW_EXTERNAL_AI_REVIEW=true)',
    enum: ['LOCAL_OLLAMA', 'GEMINI', 'CLAUDE'],
    default: 'LOCAL_OLLAMA',
  })
  @IsOptional()
  @IsIn(['LOCAL_OLLAMA', 'GEMINI', 'CLAUDE'])
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? 'LOCAL_OLLAMA'
      : value
  )
  aiProvider: AiReviewerProvider = 'LOCAL_OLLAMA';

  /**
   * กลยุทธ์การส่งแถวให้ AI Reviewer (Q3, US3 Acceptance 1)
   * - FULL (default): ส่งทุกแถวให้ AI แบบ synchronous (≤200 แถว)
   * - FAST_SELECTIVE: ส่งเฉพาะแถว WARN + สุ่ม 5% ของแถวที่เหลือ (>200 แถว)
   */
  @ApiPropertyOptional({
    description:
      'กลยุทธ์ AI Review: FULL = ตรวจทุกแถว (default, ≤200), ' +
      'FAST_SELECTIVE = ตรวจเฉพาะ WARN + สุ่ม 5% (>200 แถว, Q3)',
    enum: ['FULL', 'FAST_SELECTIVE'],
    default: 'FULL',
  })
  @IsOptional()
  @IsIn(['FULL', 'FAST_SELECTIVE'])
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === '' ? 'FULL' : value
  )
  batchStrategy: BatchStrategy = 'FULL';
}
