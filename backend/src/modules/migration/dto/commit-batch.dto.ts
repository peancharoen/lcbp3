import { IsArray, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ImportCorrespondenceDto } from './import-correspondence.dto';

export class CommitBatchItemDto {
  @IsNotEmpty()
  queueId!: number;

  @ValidateNested()
  @Type(() => ImportCorrespondenceDto)
  dto!: ImportCorrespondenceDto;
}

export class CommitBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitBatchItemDto)
  items!: CommitBatchItemDto[];

  @IsString()
  @IsNotEmpty()
  batchId!: string;
}
