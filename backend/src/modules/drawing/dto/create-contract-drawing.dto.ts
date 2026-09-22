import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateContractDrawingDto {
  // ADR-019: รับได้ทั้ง INT และ UUID publicId — service resolve ผ่าน uuidResolver
  @IsNotEmpty()
  projectId!: number | string;

  @IsString()
  @IsNotEmpty()
  contractDrawingNo!: string; // ✅ ใส่ !

  @IsString()
  @IsNotEmpty()
  title!: string; // ✅ ใส่ !

  @IsInt()
  @IsOptional()
  mapCatId?: number; // ✅ ใส่ ?

  @IsInt()
  @IsOptional()
  volumeId?: number; // ✅ ใส่ ?

  @IsInt()
  @IsOptional()
  volumePage?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attachmentIds?: number[]; // ✅ ใส่ ?

  /**
   * ADR-016 Two-Phase Upload — tempId ของ attachment จาก POST /files/upload
   * (pattern เดียวกับ CreateCorrespondenceDto.attachmentTempIds)
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentTempIds?: string[];
}
