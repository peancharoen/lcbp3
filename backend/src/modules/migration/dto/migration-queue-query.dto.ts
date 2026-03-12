import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MigrationReviewStatus } from '../entities/migration-review-queue.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class MigrationQueueQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MigrationReviewStatus })
  @IsOptional()
  @IsEnum(MigrationReviewStatus)
  status?: MigrationReviewStatus;
}
