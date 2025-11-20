import { IsInt, IsNotEmpty } from 'class-validator';

export class SubmitCorrespondenceDto {
  @IsInt()
  @IsNotEmpty()
  templateId!: number;
}
