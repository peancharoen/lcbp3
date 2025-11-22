import { IsInt, IsOptional, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchNotificationDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isRead?: boolean; // กรอง: อ่านแล้ว/ยังไม่อ่าน
}
