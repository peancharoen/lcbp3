import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForceCloseCirculationDto {
  @ApiProperty({ description: 'เหตุผลการปิดใบเวียนแบบบังคับ (บังคับกรอก)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}
