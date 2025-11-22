import {
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateRfaDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @IsInt()
  @IsNotEmpty()
  rfaTypeId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  @IsNotEmpty()
  toOrganizationId!: number; // ส่งถึงใคร (สำหรับ Routing Step 1)

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  documentDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string; // กำหนดวันตอบกลับ

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  shopDrawingRevisionIds?: number[]; // Shop Drawings ที่แนบมา
}
