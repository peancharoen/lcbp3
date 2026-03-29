import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'URGENT', description: 'ชื่อ Tag' })
  @IsString()
  @IsNotEmpty()
  tagName!: string;

  @ApiProperty({ example: 'คำอธิบาย', description: 'คำอธิบาย' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'red',
    description: 'รหัสสี หรือชื่อคลาสสำหรับ UI',
    required: false,
  })
  @IsString()
  @IsOptional()
  colorCode?: string;

  @ApiProperty({
    example: 1,
    description: 'Project ID or UUID',
    required: false,
  })
  @IsOptional()
  projectId?: number | string;
}
