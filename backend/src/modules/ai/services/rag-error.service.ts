// File: backend/src/modules/ai/services/rag-error.service.ts
// Change Log:
// - 2026-09-09: เพิ่ม layered error factory สำหรับ RAG generation (Feature 254)

import { Injectable } from '@nestjs/common';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../../common/exceptions';

/** Factory สำหรับ error ที่มี recovery guidance ตาม ADR-007 */
@Injectable()
export class RagErrorService {
  /** สร้าง error เมื่อ Attachment ยังไม่พร้อม ingest */
  public checksumRequired(attachmentPublicId: string): ValidationException {
    return new ValidationException(
      `Attachment ${attachmentPublicId} has no verified checksum`,
      [{ field: 'checksum', message: 'ไฟล์ยังไม่มี checksum ที่ตรวจสอบแล้ว' }],
      'ไฟล์ยังไม่พร้อมสำหรับการประมวลผล RAG'
    );
  }

  /** สร้าง error เมื่อไม่พบ Attachment */
  public attachmentNotFound(attachmentPublicId: string): NotFoundException {
    return new NotFoundException('Attachment', attachmentPublicId);
  }

  /** สร้าง business error สำหรับ generation state ที่ไม่ถูกต้อง */
  public invalidGenerationState(
    generationUuid: string,
    expected: string,
    actual: string
  ): BusinessException {
    return new BusinessException(
      'RAG_GENERATION_STATE_INVALID',
      `Generation ${generationUuid} is ${actual}; expected ${expected}`,
      'สถานะการประมวลผล RAG ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
      ['ตรวจสอบสถานะไฟล์', 'ลองเริ่มการประมวลผลใหม่']
    );
  }
}
