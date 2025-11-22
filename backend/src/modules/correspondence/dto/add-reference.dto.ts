import { IsInt, IsNotEmpty } from 'class-validator';

export class AddReferenceDto {
  @IsInt()
  @IsNotEmpty()
  targetId!: number;
}
