// File: src/modules/workflow-engine/dto/create-workflow-definition.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ example: 'RFA', description: 'รหัสของ Workflow' })
  @IsString()
  @IsNotEmpty()
  workflow_code!: string; // เพิ่ม !

  @ApiProperty({ description: 'นิยาม Workflow' })
  @IsObject()
  @IsNotEmpty()
  dsl!: any; // เพิ่ม !

  @ApiProperty({ description: 'เปิดใช้งานทันทีหรือไม่', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
