import {
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// Enum นี้ควรตรงกับใน Entity หรือสร้างไฟล์ enum แยก (ในที่นี้ใส่ไว้ใน DTO เพื่อความสะดวก)
export enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL',
  FOR_INFORMATION = 'FOR_INFORMATION',
  FOR_REVIEW = 'FOR_REVIEW',
  OTHER = 'OTHER',
}

export class CreateTransmittalDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number; // จำเป็นสำหรับการออกเลขที่เอกสาร (Running Number)

  @IsEnum(TransmittalPurpose)
  @IsOptional()
  purpose?: TransmittalPurpose; // วัตถุประสงค์การส่ง

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุเพิ่มเติม

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  itemIds!: number[]; // ID ของเอกสาร (Correspondence IDs) ที่จะแนบไปใน Transmittal นี้
}
