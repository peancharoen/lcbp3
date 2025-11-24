// File: src/modules/workflow-engine/dto/evaluate-workflow.dto.ts
import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EvaluateWorkflowDto {
  @ApiProperty({ example: 'RFA', description: 'รหัส Workflow' })
  @IsString()
  @IsNotEmpty()
  workflow_code!: string; // เพิ่ม !

  @ApiProperty({ example: 'DRAFT', description: 'สถานะปัจจุบัน' })
  @IsString()
  @IsNotEmpty()
  current_state!: string; // เพิ่ม !

  @ApiProperty({ example: 'SUBMIT', description: 'Action ที่ต้องการทำ' })
  @IsString()
  @IsNotEmpty()
  action!: string; // เพิ่ม !

  @ApiProperty({ description: 'Context', example: { userId: 1 } })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;
}
