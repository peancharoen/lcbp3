// File: src/modules/ai/dto/ai-rag-query.dto.ts
// Change Log
// - 2026-05-14: เพิ่ม DTO สำหรับ BullMQ RAG Query ตาม ADR-023 Phase 4.
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** DTO สำหรับส่ง RAG query เข้า BullMQ queue (FR-009, FR-010) */
export class AiRagQueryDto {
  @ApiProperty({
    description: 'คำถามสำหรับ RAG ไม่เกิน 500 ตัวอักษร',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @ApiProperty({ description: 'publicId ของโครงการ (ADR-019) เพื่อ isolation' })
  @IsUUID()
  projectPublicId!: string;
}
