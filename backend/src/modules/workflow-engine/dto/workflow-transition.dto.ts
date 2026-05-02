// File: src/modules/workflow-engine/dto/workflow-transition.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class WorkflowTransitionDto {
  @ApiProperty({
    description: 'ชื่อ Action ที่ต้องการทำ (ต้องตรงกับที่กำหนดใน DSL)',
    example: 'APPROVE',
  })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({
    description: 'ความเห็นประกอบการดำเนินการ',
    example: 'อนุมัติครับ ดำเนินการต่อได้เลย',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: 'ข้อมูลเพิ่มเติมที่ต้องการแนบไปกับ Event หรือบันทึกใน Context',
    example: { urgent: true, assign_to: 'user_123' },
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'รายการ publicId ของไฟล์แนบ (ต้องอัปโหลดผ่าน Two-Phase ก่อน — ADR-016)',
    example: ['019505a1-7c3e-7000-8000-abc123def456'],
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  attachmentPublicIds?: string[];

  @ApiPropertyOptional({
    description:
      'Optimistic lock version — ส่งค่าที่ได้จาก GET /instances/:id เพื่อป้องกัน Double-approval (ADR-001 v1.1 FR-002). Server ตอบ 409 ถ้าค่าไม่ตรง',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  versionNo?: number;
}
