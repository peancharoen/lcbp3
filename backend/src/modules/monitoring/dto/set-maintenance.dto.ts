import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetMaintenanceDto {
  @ApiProperty({ description: 'สถานะ Maintenance (true = เปิด, false = ปิด)' })
  @IsBoolean()
  enabled!: boolean; // ✅ เพิ่ม ! ตรงนี้

  @ApiProperty({
    description: 'เหตุผลที่ปิดปรับปรุง (แสดงให้ User เห็น)',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string; // Optional (?) ไม่ต้องใส่ !
}
