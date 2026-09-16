// File: backend/src/modules/migration/dto/replace-queue-file.dto.ts
// Change Log:
// - 2026-09-16: Initial creation — DTO สำหรับ PATCH /migration/queue/:publicId/file
//   (เปลี่ยนไฟล์ต้นฉบับของ queue item: เลือกจาก staging หรือผูก attachment ที่อัปโหลด)

import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับเปลี่ยนไฟล์ต้นฉบับของ migration queue item — ส่งได้อย่างใดอย่างหนึ่ง:
 * - `storageTempPath`: absolute path ของ PDF บน staging/Legacy NAS (validate ใต้ root)
 * - `tempAttachmentPublicId`: publicId ของ attachment ที่อัปโหลดผ่าน POST /files/upload
 */
export class ReplaceQueueFileDto {
  @ApiPropertyOptional({
    description:
      'Absolute path ของ PDF ภายใต้ staging/legacy NAS root (path-traversal guarded)',
  })
  @IsOptional()
  @IsString()
  storageTempPath?: string;

  @ApiPropertyOptional({
    description:
      'publicId (UUIDv7) ของ attachment ชั่วคราวจาก POST /files/upload',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  tempAttachmentPublicId?: string;
}
