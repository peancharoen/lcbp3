import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateShopDrawingDto {
  // ADR-019: รับได้ทั้ง INT และ UUID publicId — service resolve ผ่าน uuidResolver
  @IsNotEmpty()
  projectId!: number | string;

  @IsString()
  drawingNumber!: string; // !

  @IsString()
  title!: string; // !

  @IsInt()
  mainCategoryId!: number; // !

  @IsInt()
  subCategoryId!: number; // !

  // First Revision Data (Optional ทั้งหมด เพราะถ้าไม่ส่งมาจะ Default ให้)
  @IsString()
  @IsOptional()
  revisionLabel?: string; // ?

  @IsDateString()
  @IsOptional()
  revisionDate?: string; // ?

  @IsString()
  @IsOptional()
  description?: string; // ?

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  contractDrawingIds?: number[]; // ?

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attachmentIds?: number[]; // ?

  /**
   * ADR-016 Two-Phase Upload — tempId ของ attachment จาก POST /files/upload
   * (pattern เดียวกับ CreateCorrespondenceDto.attachmentTempIds)
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentTempIds?: string[];
}
