// File: backend/src/common/dto/metadata-patch.dto.ts
// บันทึกการแก้ไข: DTO สำหรับ Metadata Patch (Feature 253)

import { IsNotEmpty, IsObject, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับ Metadata Patch Request
 * ใช้ร่วมกันทุก document type — แต่ละ type มี patchableFields ของตัวเอง
 */
export class MetadataPatchRequestDto {
  @ApiProperty({
    description: 'ข้อมูลที่ต้องการ patch (key-value)',
    example: { title: 'New Title', description: 'Updated description' },
  })
  @IsObject()
  @IsNotEmpty()
  patch!: Record<string, string | number | boolean | null>;

  @ApiProperty({
    description: 'Version ปัจจุบันของเอกสาร (optimistic locking)',
    example: 3,
  })
  @IsInt()
  @Min(0)
  version!: number;
}
