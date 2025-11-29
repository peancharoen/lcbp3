// File: src/modules/rfa/dto/submit-rfa.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class SubmitRfaDto {
  @ApiProperty({
    description: 'ID ของ Routing Template ที่จะใช้เดินเรื่อง',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  templateId!: number;
}
