import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'URGENT', description: 'ชื่อ Tag' })
  @IsString()
  @IsNotEmpty()
  tag_name!: string; // เพิ่ม !

  @ApiProperty({ example: 'คำอธิบาย', description: 'คำอธิบาย' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 1,
    description: 'Project ID or UUID',
    required: false,
  })
  @IsOptional()
  project_id?: number | string;
}
