// File: backend/src/modules/notification/telegram/dto/link-code-request.dto.ts
// Change Log:
// - 2026-09-25: Initial creation — DTO สำหรับ admin ออก group link code (Feature 258)

import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request สำหรับ POST /admin/notifications/channels/link-code
 * — admin เลือก scope ที่จะผูก (project / user group / department อย่างใดอย่างหนึ่ง)
 *   แล้วนำ code ไปพิมพ์ `/link <code>` ใน Telegram group/topic
 */
export class LinkCodeRequestDto {
  @ApiPropertyOptional({
    description: 'Project publicId (UUID) ที่จะผูกกับ Telegram group',
  })
  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  @ApiPropertyOptional({
    description:
      'User Group publicId (UUID) — claim-based fan-out (เช่น circulation)',
  })
  @IsOptional()
  @IsUUID()
  userGroupPublicId?: string;

  @ApiPropertyOptional({
    description: 'Department publicId (UUID) ที่จะผูกกับ Telegram group',
  })
  @IsOptional()
  @IsUUID()
  departmentPublicId?: string;

  @ApiPropertyOptional({
    description:
      'ชื่อแสดงผลของ channel ใน admin console (เช่น ชื่อกลุ่ม/topic)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}
