// File: src/modules/user/dto/update-preference.dto.ts
// บันทึกการแก้ไข: DTO สำหรับตรวจสอบข้อมูลการอัปเดต User Preferences (T1.3)

import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger'; // ใช้สำหรับสร้าง API Documentation (Swagger)

export class UpdatePreferenceDto {
  @ApiPropertyOptional({
    description: 'รับการแจ้งเตือนทางอีเมลหรือไม่',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional({
    description: 'รับการแจ้งเตือนทาง LINE หรือไม่',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyLine?: boolean;

  @ApiPropertyOptional({
    description:
      'รับการแจ้งเตือนแบบรวม (Digest) แทน Real-time เพื่อลดจำนวนข้อความ',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;

  @ApiPropertyOptional({
    description: 'ธีมของหน้าจอ (light, dark, หรือ system)',
    default: 'light',
    enum: ['light', 'dark', 'system'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system']) // บังคับว่าต้องเป็นค่าใดค่าหนึ่งในนี้เท่านั้น
  uiTheme?: string;
}
