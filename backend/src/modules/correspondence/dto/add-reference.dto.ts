import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReferenceDto {
  @ApiProperty({
    description: 'Target Correspondence UUID to reference (ADR-019)',
    example: '019505a1-7c3e-7000-8000-abc123def456',
  })
  @IsUUID('all')
  @IsNotEmpty()
  targetUuid!: string;
}
