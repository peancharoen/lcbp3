import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitCorrespondenceDto {
  @ApiProperty({
    description: 'ID of the Workflow Template to start',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  templateId!: number;
}
