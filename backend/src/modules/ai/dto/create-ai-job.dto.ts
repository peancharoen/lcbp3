// File: backend/src/modules/ai/dto/create-ai-job.dto.ts
// Change Log:
// - 2026-06-11: Refactored CreateAiJobDto to support new AI runtime policy contract (Option B)
// - 2026-06-11: เพิ่ม IsObject ใน class-validator import
// - 2026-06-11: ใช้ import type สำหรับ PublicJobType เพื่อแก้ปัญหา TS1272

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsObject,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import type { PublicJobType } from '../interfaces/execution-policy.interface';

/**
 * Custom decorator to forbid specific properties in payload.
 * เดคอเรเตอร์สำหรับป้องกันไม่ให้ส่งฟิลด์ที่กำหนดมาใน API payload
 */
export function IsForbidden(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isForbidden',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return value === undefined;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} is forbidden in payload. Backend determines execution policy.`;
        },
      },
    });
  };
}

export class CreateAiJobDto {
  @ApiProperty({
    enum: ['auto-fill-document', 'migrate-document', 'rag-query'],
    description: 'ชนิดงาน AI ที่ต้อง enqueue',
  })
  @IsEnum(['auto-fill-document', 'migrate-document', 'rag-query'])
  type!: PublicJobType;

  @ApiPropertyOptional({
    description: 'Document publicId (UUIDv7) สำหรับงาน AI',
  })
  @IsOptional()
  @IsUUID('all')
  documentPublicId?: string;

  @ApiPropertyOptional({
    description: 'Attachment publicId (UUIDv7) สำหรับงาน AI',
  })
  @IsOptional()
  @IsUUID('all')
  attachmentPublicId?: string;

  @ApiPropertyOptional({
    description: 'Payload ข้อมูลเพิ่มเติมสำหรับงานแต่ละประเภท',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Project publicId สำหรับ project isolation',
  })
  @IsOptional()
  @IsUUID('all')
  projectPublicId?: string;

  // ฟิลด์ต้องห้ามตามข้อกำหนด FR-A01 เพื่อป้องกันการแทรกแซง policy จาก caller
  @IsForbidden()
  executionProfile?: unknown;

  @IsForbidden()
  model?: unknown;

  @IsForbidden()
  temperature?: unknown;

  @IsForbidden()
  top_p?: unknown;

  @IsForbidden()
  maxTokens?: unknown;
}
