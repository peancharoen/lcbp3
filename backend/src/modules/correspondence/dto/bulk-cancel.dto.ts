import {
  IsArray,
  IsString,
  IsUUID,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

export class BulkCancelDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  uuids!: string[];

  @IsString()
  @MinLength(3)
  reason!: string;
}
