// File: backend/src/modules/migration/dto/start-extract.dto.ts
// Change Log:
// - 2026-08-22: เพิ่ม DTO สำหรับเริ่มประมวลผล OCR/AI ของ migration queue item (ADR-047)

import { IsNotEmpty, IsArray, IsString, IsUUID } from 'class-validator';

/** เริ่มประมวลผล OCR/AI ของ queue item เดียว */
export class StartExtractDto {
  @IsUUID()
  @IsNotEmpty()
  queuePublicId!: string;
}

/** เริ่มประมวลผล OCR/AI แบบ batch */
export class StartExtractBatchDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  queuePublicIds!: string[];
}
