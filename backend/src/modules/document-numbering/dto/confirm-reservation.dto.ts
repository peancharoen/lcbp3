import { IsString, IsInt, IsOptional } from 'class-validator';

export class ConfirmReservationDto {
  @IsString()
  token!: string;

  @IsInt()
  @IsOptional()
  documentId?: number;
}

export class ConfirmReservationResponseDto {
  documentNumber!: string;
  confirmedAt!: Date;
}
