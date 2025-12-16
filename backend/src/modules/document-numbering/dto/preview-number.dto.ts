// File: src/modules/document-numbering/dto/preview-number.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewNumberDto {
  @ApiProperty({ description: 'Project ID' })
  projectId!: number;

  @ApiProperty({ description: 'Originator organization ID' })
  originatorId!: number;

  @ApiProperty({ description: 'Correspondence type ID' })
  typeId!: number;

  @ApiPropertyOptional({ description: 'Sub type ID (for TRANSMITTAL)' })
  subTypeId?: number;

  @ApiPropertyOptional({ description: 'RFA type ID (for RFA)' })
  rfaTypeId?: number;

  @ApiPropertyOptional({ description: 'Discipline ID' })
  disciplineId?: number;

  @ApiPropertyOptional({ description: 'Year (defaults to current)' })
  year?: number;

  @ApiPropertyOptional({ description: 'Recipient organization ID' })
  recipientOrganizationId?: number;
}
