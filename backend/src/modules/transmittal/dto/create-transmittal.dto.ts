import {
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL',
  FOR_INFORMATION = 'FOR_INFORMATION',
  FOR_REVIEW = 'FOR_REVIEW',
  OTHER = 'OTHER',
}

export class TransmittalItemDto {
  @ApiProperty({
    description: 'ประเภทรายการ (DRAWING, RFA, CORRESPONDENCE)',
    example: 'DRAWING',
  })
  @IsString()
  @IsNotEmpty()
  itemType!: string;

  @ApiProperty({ description: 'ID ของรายการ', example: 1 })
  @IsInt()
  @IsNotEmpty()
  itemId!: number;

  @ApiProperty({ description: 'รายละเอียดเพิ่มเติม', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateTransmittalDto {
  @ApiProperty({ description: 'ID ของโครงการ', example: 1 })
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @ApiProperty({
    description: 'เรื่อง',
    example: 'Transmittal for Shop Drawings',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'ผู้รับ (Organization ID)', example: 2 })
  @IsInt()
  @IsNotEmpty()
  recipientOrganizationId!: number;

  @ApiProperty({
    description: 'วัตถุประสงค์',
    enum: TransmittalPurpose,
    example: TransmittalPurpose.FOR_APPROVAL,
  })
  @IsEnum(TransmittalPurpose)
  @IsOptional()
  purpose?: TransmittalPurpose;

  @ApiProperty({ description: 'รายการที่แนบ', type: [TransmittalItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransmittalItemDto)
  items!: TransmittalItemDto[];
}
