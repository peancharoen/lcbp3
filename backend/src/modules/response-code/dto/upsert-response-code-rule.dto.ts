// File: src/modules/response-code/dto/upsert-response-code-rule.dto.ts
// Change Log:
// - 2026-05-13: Add DTO for response code matrix rule upsert endpoints.

import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertResponseCodeRuleDto {
  @IsInt()
  @Min(1)
  documentTypeId!: number;

  @IsUUID()
  responseCodePublicId!: string;

  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  @IsBoolean()
  isEnabled!: boolean;

  @IsOptional()
  @IsBoolean()
  requiresComments?: boolean;

  @IsOptional()
  @IsBoolean()
  triggersNotification?: boolean;
}
