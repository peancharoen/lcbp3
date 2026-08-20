// File: backend/src/modules/migration/dto/start-ingest.dto.ts
// Change Log:
// - 2026-08-20: สร้าง DTO สำหรับเริ่มต้นการ Ingest ไฟล์ Excel เอกสาร Legacy (ADR-047)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartIngestDto {
  @ApiProperty({
    description: 'Path ของไฟล์ Excel บน Server หรือ Temp Storage',
    example: '/share/np-dms/staging_ai/legacy-docs.xlsx',
  })
  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @ApiProperty({
    description: 'UUIDv7 ของโครงการเป้าหมาย (ADR-019)',
    example: '019505a1-7c3e-7000-8000-abc123def456',
  })
  @IsUUID('all')
  @IsNotEmpty()
  projectPublicId!: string;

  @ApiPropertyOptional({
    description: 'รหัสคู่สัญญา (เช่น LCBP3-C1, LCBP3-C2)',
    example: 'LCBP3-C2',
  })
  @IsString()
  @IsOptional()
  contractCode?: string;

  @ApiPropertyOptional({
    description: 'ชื่อ Worksheet ใน Excel (ค่าเริ่มต้นคือ Sheet แรก)',
    example: 'Documents',
  })
  @IsString()
  @IsOptional()
  sheetName?: string;

  @ApiPropertyOptional({
    description: 'โฟลเดอร์ Staging ที่เก็บไฟล์ PDF ต้นทาง',
    example: '/share/np-dms/staging_ai/',
  })
  @IsString()
  @IsOptional()
  pdfFolderPath?: string;

  @ApiPropertyOptional({
    description: 'รหัสชุดการนำเข้า (Batch ID) กำหนดเองได้',
    example: 'BATCH-20260820-001',
  })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'สั่งทำต่อจากจุด Checkpoint เดิมที่ค้างอยู่หรือไม่',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  resume?: boolean;
}
