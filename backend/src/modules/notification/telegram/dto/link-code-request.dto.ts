// File: backend/src/modules/notification/telegram/dto/link-code-request.dto.ts
// Change Log:
// - 2026-09-25: Initial creation — DTO สำหรับ admin ออก group link code (Feature 258)

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request สำหรับ POST /admin/notifications/channels/link-code
 * — admin เลือก project ที่จะผูกก่อน แล้วนำ code ไปพิมพ์ `/link <code>` ใน Telegram group/topic
 */
export class LinkCodeRequestDto {
  @ApiProperty({
    description: 'Project publicId (UUID) ที่จะผูกกับ Telegram group',
  })
  @IsUUID()
  @IsNotEmpty()
  projectPublicId!: string;

  @ApiPropertyOptional({
    description:
      'ชื่อแสดงผลของ channel ใน admin console (เช่น ชื่อกลุ่ม/topic)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}
