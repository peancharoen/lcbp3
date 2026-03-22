import { IsInt, IsString, IsNotEmpty, _IsOptional } from 'class-validator';

export class SaveNumberFormatDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @IsInt()
  @IsNotEmpty()
  correspondenceTypeId!: number;

  @IsString()
  @IsNotEmpty()
  formatTemplate!: string; // เช่น '{ORG}-{TYPE}-{DISCIPLINE}-{SEQ:4}'
}
