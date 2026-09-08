import { IsString, IsOptional } from 'class-validator';

export class ReindexSearchDto {
  @IsString()
  @IsOptional()
  type?: string; // จำกัด reindex เฉพาะประเภท: 'rfa' | 'correspondence' — ไม่ระบุ = ทุกประเภท
}
