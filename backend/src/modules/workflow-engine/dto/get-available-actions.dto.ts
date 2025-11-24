// File: src/modules/workflow-engine/dto/get-available-actions.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetAvailableActionsDto {
  @ApiProperty({ description: 'รหัส Workflow', example: 'RFA' })
  @IsString()
  @IsNotEmpty()
  workflow_code!: string; // เพิ่ม !

  @ApiProperty({ description: 'สถานะปัจจุบัน', example: 'DRAFT' })
  @IsString()
  @IsNotEmpty()
  current_state!: string; // เพิ่ม !
}
