import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RagQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @IsUUID()
  projectPublicId!: string;
}
