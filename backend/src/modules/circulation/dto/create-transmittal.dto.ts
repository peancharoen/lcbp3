import {
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';

export enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL',
  FOR_INFORMATION = 'FOR_INFORMATION',
  FOR_REVIEW = 'FOR_REVIEW',
  OTHER = 'OTHER',
}

export class CreateTransmittalDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number; // จำเป็นสำหรับการออกเลขที่เอกสาร

  @IsEnum(TransmittalPurpose)
  @IsOptional()
  purpose?: TransmittalPurpose; // วัตถุประสงค์

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุ

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  itemIds!: number[]; // ID ของเอกสาร (Correspondence IDs) ที่จะแนบไปใน Transmittal
}
