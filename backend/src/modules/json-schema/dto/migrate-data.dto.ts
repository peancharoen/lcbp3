// File: src/modules/json-schema/dto/migrate-data.dto.ts
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MigrateDataDto {
  @ApiProperty({ description: 'The schema code to migrate to (e.g., RFA_DWG)' })
  @IsString()
  @IsNotEmpty()
  targetSchemaCode!: string;

  @ApiProperty({
    description: 'Target version. If omitted, migrates to latest.',
    required: false,
  })
  @IsInt()
  @IsOptional()
  targetVersion?: number;
}

