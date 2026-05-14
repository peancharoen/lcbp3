// File: src/modules/distribution/dto/update-distribution-matrix.dto.ts
// Change Log
// - 2026-05-14: Add validated DTO for Distribution Matrix updates.
import { PartialType } from '@nestjs/swagger';
import { CreateDistributionMatrixDto } from './create-distribution-matrix.dto';

export class UpdateDistributionMatrixDto extends PartialType(
  CreateDistributionMatrixDto
) {}
