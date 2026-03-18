import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchContractDrawingDto {
  @IsUUID()
  projectUuid!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  volumeId?: number; // Optional: ใส่ ?

  @IsOptional()
  @IsInt()
  @IsOptional()
  mapCatId?: number; // Optional: ใส่ ?

  @IsOptional()
  @IsString()
  search?: string; // Optional: ใส่ ?

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1; // มีค่า Default ไม่ต้องใส่ ! หรือ ?

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;

  @IsOptional()
  @IsString()
  type?: string;
}
