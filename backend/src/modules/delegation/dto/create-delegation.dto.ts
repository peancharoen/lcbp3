// File: src/modules/delegation/dto/create-delegation.dto.ts
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DelegationScope } from '../../common/enums/review.enums';

export { DelegationScope };

export class CreateDelegationDto {
  @IsUUID()
  delegateUserPublicId!: string;

  @IsEnum(DelegationScope)
  scope!: DelegationScope;

  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @IsDate()
  @Type(() => Date)
  endDate!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
