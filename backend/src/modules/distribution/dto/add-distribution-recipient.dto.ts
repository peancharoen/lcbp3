// File: src/modules/distribution/dto/add-distribution-recipient.dto.ts
// Change Log
// - 2026-05-14: Add validated DTO for polymorphic Distribution recipients.
import { IsEnum, IsInt, IsOptional, IsUUID } from 'class-validator';
import { DeliveryMethod, RecipientType } from '../../common/enums/review.enums';

export class AddDistributionRecipientDto {
  @IsEnum(RecipientType)
  recipientType!: RecipientType;

  @IsUUID()
  recipientPublicId!: string;

  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @IsOptional()
  @IsInt()
  sequence?: number;
}
