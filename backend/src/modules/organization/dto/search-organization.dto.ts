import { IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchOrganizationDto {
  @ApiPropertyOptional({ description: 'Search term (code or name)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Role ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  roleId?: number;

  @ApiPropertyOptional({ description: 'Filter by Project ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 100;

  @ApiPropertyOptional({ description: 'Filter by Active status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
