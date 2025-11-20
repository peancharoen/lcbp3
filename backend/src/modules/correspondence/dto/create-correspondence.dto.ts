import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateCorrespondenceDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @IsInt()
  @IsNotEmpty()
  typeId!: number; // ID ของประเภทเอกสาร (เช่น RFA, LETTER)

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, any>; // ข้อมูล JSON (เช่น RFI question)

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  // (Optional) ถ้าจะมีการแนบไฟล์มาด้วยเลย
  // @IsArray()
  // @IsString({ each: true })
  // attachmentTempIds?: string[];
}
