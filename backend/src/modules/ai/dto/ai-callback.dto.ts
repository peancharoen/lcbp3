// File: src/modules/ai/dto/ai-callback.dto.ts
// DTO สำหรับ Callback จาก n8n หลังจาก AI ประมวลผลเสร็จ (ADR-018 AI Communication Contract)

import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiAuditStatus } from '../entities/ai-audit-log.entity';

// Metadata ที่ AI สกัดได้จากเอกสาร
export interface AiExtractedMetadata {
  subject?: string;
  date?: string; // รูปแบบ YYYY-MM-DD
  discipline?: string; // Civil|Mechanical|Electrical|Architectural
  drawingReference?: string;
  contractNumber?: string;
  documentType?: string;
  discrepancies?: string[]; // รายการที่ไม่สอดคล้องกัน
  [key: string]: unknown;
}

export class AiCallbackDto {
  // UUID ของ MigrationLog ที่เกี่ยวข้อง (ADR-019)
  @ApiProperty({ description: 'publicId ของ MigrationLog (UUID)' })
  @IsUUID()
  migrationLogPublicId!: string;

  // ชื่อ AI Model ที่ใช้ประมวลผล
  @ApiProperty({ description: 'ชื่อ AI Model เช่น gemma4, paddleocr' })
  @IsString()
  @MaxLength(50)
  aiModel!: string;

  // สถานะการประมวลผล
  @ApiProperty({ enum: AiAuditStatus })
  @IsEnum(AiAuditStatus)
  status!: AiAuditStatus;

  // คะแนนความมั่นใจ (0.00-1.00)
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore?: number;

  // Metadata ที่ AI สกัดได้
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  extractedMetadata?: AiExtractedMetadata;

  // เวลาประมวลผล (milliseconds)
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  processingTimeMs?: number;

  // SHA-256 hash ของ Input เพื่อ Audit
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inputHash?: string;

  // SHA-256 hash ของ Output เพื่อ Audit
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  outputHash?: string;

  // ข้อความ Error (ถ้า status เป็น FAILED หรือ TIMEOUT)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
