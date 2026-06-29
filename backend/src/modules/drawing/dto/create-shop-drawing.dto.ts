import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateShopDrawingDto {
  @IsInt()
  projectId!: number; // !

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
}
