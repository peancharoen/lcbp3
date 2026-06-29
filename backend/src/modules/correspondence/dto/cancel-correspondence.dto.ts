import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CancelCorrespondenceDto {
  @ApiProperty({
    description: 'Reason for cancelling the correspondence',
    example: 'Document was created in error',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
