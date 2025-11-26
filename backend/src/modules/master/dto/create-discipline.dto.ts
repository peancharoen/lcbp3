import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateDisciplineDto {
  @IsInt()
  @IsNotEmpty()
  contractId!: number;

  @IsString()
  @IsNotEmpty()
  disciplineCode!: string; // เช่น 'STR', 'ARC'

  @IsString()
  @IsOptional()
  codeNameTh?: string;

  @IsString()
  @IsOptional()
  codeNameEn?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
