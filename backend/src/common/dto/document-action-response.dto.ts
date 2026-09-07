// File: backend/src/common/dto/document-action-response.dto.ts
// บันทึกการแก้ไข: Response DTO สำหรับ document actions (Feature 253)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Side effects ที่เกิดขึ้นหลังการกระทำเอกสาร
 */
export class SideEffectsResponseDto {
  @ApiProperty({ description: 're-index search สำเร็จหรือไม่' })
  searchReindexed!: boolean;

  @ApiProperty({ description: 'จำนวน notifications ที่ส่ง' })
  notificationsSent!: number;

  @ApiProperty({ description: 'workflow ถูก terminate หรือไม่' })
  workflowTerminated!: boolean;

  @ApiProperty({ description: 'จำนวน circulation ที่ force-close' })
  circulationsClosed!: number;

  @ApiProperty({
    description: 'สถานะการลบ vector',
    enum: ['COMPLETED', 'PENDING_RETRY', 'SKIPPED'],
  })
  vectorsDeleted!: 'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED';

  @ApiProperty({ description: 'จำนวนไฟล์ที่ลบจาก Storage' })
  filesDeleted!: number;
}

/**
 * Response DTO สำหรับการกระทำเอกสาร (Cancel / Hard-Delete / Metadata Patch)
 */
export class DocumentActionResponseDto {
  @ApiProperty({ description: 'ผลลัพธ์สำเร็จหรือไม่' })
  success!: boolean;

  @ApiProperty({ description: 'publicId ของเอกสาร' })
  publicId!: string;

  @ApiProperty({
    description: 'ประเภทการกระทำ',
    enum: ['CANCEL', 'HARD_DELETE', 'METADATA_PATCH'],
  })
  action!: 'CANCEL' | 'HARD_DELETE' | 'METADATA_PATCH';

  @ApiPropertyOptional({ type: SideEffectsResponseDto })
  sideEffects?: SideEffectsResponseDto;

  @ApiPropertyOptional({ description: 'side effects ที่ล้มเหลว' })
  failedSideEffects?: string[];

  @ApiPropertyOptional({ description: 'publicId ของ audit log' })
  auditId?: string;

  @ApiPropertyOptional({ description: 'version ใหม่ของเอกสารหลังแก้ไข' })
  newVersion?: number;
}
