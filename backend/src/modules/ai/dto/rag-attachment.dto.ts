// File: backend/src/modules/ai/dto/rag-attachment.dto.ts
// Change Log:
// - 2026-09-09: เพิ่ม DTO สำหรับ RAG Attachment ingestion/query (Feature 254)

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** DTO สำหรับเริ่ม ingestion ของ Attachment */
export class RagAttachmentIngestDto {
  @ApiPropertyOptional({
    description: 'บังคับสร้าง generation ใหม่แม้ checksum เดิม',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

/** DTO สำหรับ query RAG ที่บังคับ Project scope */
export class RagAttachmentQueryDto {
  @ApiProperty({ description: 'UUIDv7 ของ owning Project' })
  @IsUUID('7')
  projectPublicId!: string;

  @ApiProperty({ description: 'คำถามสำหรับ RAG' })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiPropertyOptional({ description: 'จำนวนผลลัพธ์สูงสุด', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;
}

/** DTO สำหรับเปลี่ยน classification ของ Attachment (Superadmin only) */
export class RagClassificationOverrideDto {
  @ApiProperty({
    description: 'Classification ใหม่',
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'])
  classification!: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

  @ApiPropertyOptional({
    description: 'เหตุผลในการเปลี่ยน classification (บันทึกใน audit trail)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

/** DTO สำหรับ citation ผลลัพธ์การค้นหา RAG */
export class RagCitationDto {
  @ApiProperty({ description: 'UUIDv7 ของ chunk' })
  chunkPublicId!: string;

  @ApiProperty({ description: 'UUIDv7 ของ attachment' })
  attachmentPublicId!: string;

  @ApiProperty({ description: 'ประเภทเจ้าของเอกสาร' })
  ownerType!: string;

  @ApiProperty({ description: 'UUIDv7 ของเอกสารเจ้าของ' })
  ownerPublicId!: string;

  @ApiProperty({ description: 'เนื้อหาของ chunk' })
  content!: string;

  @ApiProperty({
    description: 'ประเภท source segment (PAGE/SECTION/SHEET/WHOLE_DOCUMENT)',
    enum: ['PAGE', 'SECTION', 'SHEET', 'WHOLE_DOCUMENT'],
  })
  segmentType!: 'PAGE' | 'SECTION' | 'SHEET' | 'WHOLE_DOCUMENT';

  @ApiPropertyOptional({ description: 'หมายเลขหน้า/segment' })
  @IsOptional()
  segmentNumber?: number;

  @ApiPropertyOptional({ description: 'ป้ายกำกับ segment' })
  @IsOptional()
  segmentLabel?: string;

  @ApiPropertyOptional({ description: 'ตำแหน่งอ้างอิงในไฟล์' })
  @IsOptional()
  sourceLocator?: string;

  @ApiProperty({ description: 'คะแนนความเกี่ยวข้อง' })
  score!: number;
}
