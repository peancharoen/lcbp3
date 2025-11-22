import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateContractDrawingDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number; // ✅ ใส่ !

  @IsString()
  @IsNotEmpty()
  contractDrawingNo!: string; // ✅ ใส่ !

  @IsString()
  @IsNotEmpty()
  title!: string; // ✅ ใส่ !

  @IsInt()
  @IsOptional()
  subCategoryId?: number; // ✅ ใส่ ?

  @IsInt()
  @IsOptional()
  volumeId?: number; // ✅ ใส่ ?

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attachmentIds?: number[]; // ✅ ใส่ ?
}
