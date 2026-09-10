// File: backend/src/modules/ai/dto/rag-query-response.dto.ts
// Change Log:
// - 2026-09-12: เพิ่ม RAG query response DTO ตาม retrieval contract (Feature 254, Phase 4 US2, T042)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** ประเภท source segment ที่ citation รองรับ (ตรงกับ RagSegmentType) */
export enum RagSegmentType {
  PAGE = 'PAGE',
  SECTION = 'SECTION',
  SHEET = 'SHEET',
  WHOLE_DOCUMENT = 'WHOLE_DOCUMENT',
}

/** โหมด retrieval ที่ใช้ในการค้นหา (ตาม contract rag-retrieval.md) */
export enum RetrievalMode {
  VECTOR = 'VECTOR',
  FULL_TEXT = 'FULL_TEXT',
  HYBRID = 'HYBRID',
}

/**
 * DTO สำหรับ citation ผลลัพธ์การค้นหา RAG ที่ปลอดภัยสำหรับส่งกลับ frontend
 * - ไม่เปิดเผย generationUuid ตาม contract (ADR-019 publicId เท่านั้น)
 */
export class RagCitationDto {
  @ApiProperty({ description: 'UUIDv7 ของ attachment ที่เป็นเจ้าของ chunk' })
  @IsUUID('7')
  attachmentPublicId!: string;

  @ApiProperty({ description: 'ประเภทเอกสารเจ้าของ (เช่น CORRESPONDENCE)' })
  @IsString()
  ownerType!: string;

  @ApiProperty({ description: 'UUIDv7 ของเอกสารเจ้าของ' })
  @IsUUID('7')
  ownerPublicId!: string;

  @ApiPropertyOptional({ description: 'ตำแหน่งอ้างอิงในไฟล์ต้นฉบับ' })
  @IsOptional()
  @IsString()
  sourceLocator?: string;

  @ApiProperty({
    enum: RagSegmentType,
    description: 'ประเภท segment ของ chunk',
  })
  @IsEnum(RagSegmentType)
  segmentType!: RagSegmentType;

  @ApiPropertyOptional({ description: 'หมายเลข segment (หน้า/section)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  segmentNumber?: number;

  @ApiPropertyOptional({ description: 'ป้ายกำกับ segment ที่มนุษย์อ่านได้' })
  @IsOptional()
  @IsString()
  segmentLabel?: string;

  @ApiProperty({ description: 'ตำแหน่งเริ่มต้นของ snippet ใน source (string)' })
  @IsString()
  startOffset!: string;

  @ApiProperty({ description: 'ตำแหน่งสิ้นสุดของ snippet ใน source (string)' })
  @IsString()
  endOffset!: string;

  @ApiProperty({ description: 'เนื้อหา snippet ของ chunk ที่นำมาเป็นบริบท' })
  @IsString()
  snippet!: string;

  @ApiProperty({ description: 'คะแนนความเกี่ยวข้องของ chunk' })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiProperty({ description: 'UUIDv7 ของ chunk' })
  @IsUUID('7')
  chunkPublicId!: string;
}

/**
 * DTO สำหรับ response ของ POST /api/ai/rag/query ตาม retrieval contract
 * - ไม่รวม generationUuid ใน response (ตาม contract)
 */
export class RagQueryResponseDto {
  @ApiProperty({ description: 'คำตอบจาก LLM ที่ประกอบจาก context ของ chunks' })
  @IsString()
  answer!: string;

  @ApiProperty({
    type: [RagCitationDto],
    description: 'รายการ citation ของ chunks ที่ใช้เป็นบริบท',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RagCitationDto)
  sources!: RagCitationDto[];

  @ApiProperty({
    enum: RetrievalMode,
    description: 'โหมด retrieval ที่ใช้ (VECTOR | FULL_TEXT | HYBRID)',
  })
  @IsEnum(RetrievalMode)
  retrievalMode!: RetrievalMode;
}
