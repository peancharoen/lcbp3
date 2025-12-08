import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReferenceDto {
  @ApiProperty({
    description: 'Target Correspondence ID to reference',
    example: 20,
  })
  @IsInt()
  @IsNotEmpty()
  targetId!: number;
}
