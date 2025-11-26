import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSubTypeDto {
  @IsInt()
  @IsNotEmpty()
  contractId!: number;

  @IsInt()
  @IsNotEmpty()
  correspondenceTypeId!: number;

  @IsString()
  @IsNotEmpty()
  subTypeCode!: string; // เช่น 'MAT'

  @IsString()
  @IsOptional()
  subTypeName?: string;

  @IsString()
  @IsOptional()
  subTypeNumber?: string; // เช่น '11'
}
