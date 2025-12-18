import { IsInt, IsOptional, IsObject } from 'class-validator';

export class ReserveNumberDto {
  @IsInt()
  projectId!: number;

  @IsInt()
  originatorOrganizationId!: number;

  @IsInt()
  @IsOptional()
  recipientOrganizationId?: number;

  @IsInt()
  correspondenceTypeId!: number;

  @IsInt()
  @IsOptional()
  subTypeId?: number;

  @IsInt()
  @IsOptional()
  rfaTypeId?: number;

  @IsInt()
  @IsOptional()
  disciplineId?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReserveNumberResponseDto {
  token!: string;
  documentNumber!: string;
  expiresAt!: Date;
}
