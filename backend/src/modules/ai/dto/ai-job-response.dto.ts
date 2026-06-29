// File: backend/src/modules/ai/dto/ai-job-response.dto.ts
// Change Log:
// - 2026-06-11: Initial creation of AiJobResponseDto for unified AI jobs response
// - 2026-06-11: ใช้ import type สำหรับ ExecutionProfile เพื่อแก้ปัญหา TS1272

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import type { ExecutionProfile } from '../interfaces/execution-policy.interface';

export class AiJobResponseDto {
  @ApiProperty({ description: 'ID ของงานในคิว BullMQ' })
  @IsString()
  jobId!: string;

  @ApiProperty({
    enum: ['queued', 'completed', 'failed'],
    description: 'สถานะของงานในคิว',
  })
  @IsEnum(['queued', 'completed', 'failed'])
  status!: 'queued' | 'completed' | 'failed';

  @ApiProperty({
    enum: ['np-dms-ai', 'np-dms-ocr'],
    description: 'ชื่อโมเดลมาตรฐาน (Canonical Name) ที่ใช้งาน',
  })
  @IsEnum(['np-dms-ai', 'np-dms-ocr'])
  modelUsed!: 'np-dms-ai' | 'np-dms-ocr';

  @ApiProperty({
    enum: ['interactive', 'standard', 'quality', 'deep-analysis'],
    description: 'โปรไฟล์การประมวลผลจริงที่ระบบกำหนดให้',
  })
  @IsEnum(['interactive', 'standard', 'quality', 'deep-analysis'])
  effectiveProfile!: ExecutionProfile;

  @ApiProperty({
    enum: ['ai-realtime', 'ai-batch'],
    description: 'ชื่อคิวที่ใช้ประมวลผล',
  })
  @IsEnum(['ai-realtime', 'ai-batch'])
  queueName!: 'ai-realtime' | 'ai-batch';
}
