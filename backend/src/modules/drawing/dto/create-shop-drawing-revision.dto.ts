import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsInt,
} from 'class-validator';

export class CreateShopDrawingRevisionDto {
  @IsString()
  revisionLabel!: string; // จำเป็น: ใส่ !

  @IsString()
  title!: string; // Add title

  @IsString()
  @IsOptional()
  legacyDrawingNumber?: string;

  @IsDateString()
  @IsOptional()
  revisionDate?: string; // Optional: ใส่ ?

  @IsString()
  @IsOptional()
  description?: string; // Optional: ใส่ ?

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  contractDrawingIds?: number[]; // Optional: ใส่ ?

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attachmentIds?: number[]; // Optional: ใส่ ?
}
