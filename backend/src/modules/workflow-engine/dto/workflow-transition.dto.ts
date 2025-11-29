// File: src/modules/workflow-engine/dto/workflow-transition.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

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
  payload?: Record<string, any>;
}
