// File: backend/src/modules/ai/services/rag-attachment-ingestion.service.ts
// Change Log:
// - 2026-09-10: Delegate markVerified/activate/markFailed/getStatus to RagGenerationStateService (Feature 254 code review)
// - 2026-09-14: T061 เพิ่ม ZIP validation + ClamAV scanning ผ่าน SecureArchiveService (Feature 254, Phase 6 US4)
// - 2026-09-10: T027 extract ingestion logic จาก RagGenerationService มาเป็น RagAttachmentIngestionService (Feature 254)

import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { SecureArchiveService } from '../../../common/file-storage/secure-archive.service';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagErrorService } from './rag-error.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagGenerationStateService } from './rag-generation-state.service';
import {
  BusinessException,
  ValidationException,
} from '../../../common/exceptions';
import { RagGenerationStatus } from '../interfaces/rag-attachment.types';

/**
 * Service สำหรับ ingestion lifecycle ของ RAG Attachment
 * ทำหน้าที่: checksum readiness guard, mismatch handling, BUILDING creation,
 * idempotent ACTIVE reuse, markVerified, markFailed, activate
 *
 * State transition methods (markVerified, activate, markFailed, getStatus)
 * delegate ไปยัง RagGenerationStateService ที่ใช้ร่วมกับ RagGenerationService
 */
@Injectable()
export class RagAttachmentIngestionService {
  private static readonly CHECKSUM_LENGTH = 64;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    private readonly dataSource: DataSource,
    private readonly lockService: RagGenerationLockService,
    private readonly errorService: RagErrorService,
    private readonly stateService: RagGenerationStateService,
    @Optional() private readonly secureArchiveService?: SecureArchiveService
  ) {}

  /**
   * เริ่ม ingestion สำหรับ Attachment หนึ่งไฟล์
   * ตรวจ checksum readiness, ตรวจ mismatch กับ BUILDING generation เดิม,
   * และ reuse ACTIVE generation เดิมเมื่อ checksum ตรง (idempotent path)
   */
  public async ingest(
    attachmentPublicId: string,
    force = false
  ): Promise<RagAttachmentGeneration> {
    const lock = await this.lockService.acquire(attachmentPublicId);
    try {
      const attachment = await this.attachmentRepository.findOne({
        where: { publicId: attachmentPublicId },
      });
      if (!attachment) {
        throw this.errorService.attachmentNotFound(attachmentPublicId);
      }
      if (!attachment.checksum) {
        throw this.errorService.checksumRequired(attachmentPublicId);
      }

      // T061: ZIP security validation — ตรวจสอบ ZIP ก่อนเริ่ม ingestion (ADR-016, FR-038)
      // ถ้าเป็น ZIP และมี SecureArchiveService ให้ validate ความปลอดภัย
      // (path traversal, encryption, ClamAV, nested depth, file count, expanded size)
      if (
        this.secureArchiveService &&
        attachment.mimeType === 'application/zip' &&
        attachment.filePath
      ) {
        await this.secureArchiveService.extractSecurely(attachment.filePath);
      }

      const existing = await this.generationRepository.findOne({
        where: { attachmentUuid: attachmentPublicId },
        order: { createdAt: 'DESC' },
      });

      if (existing) {
        if (
          existing.status === 'BUILDING' &&
          existing.attachmentChecksumSnapshot !== attachment.checksum
        ) {
          throw new BusinessException(
            'CHECKSUM_MISMATCH',
            `Attachment checksum ${attachment.checksum} does not match BUILDING generation snapshot ${existing.attachmentChecksumSnapshot}`,
            'checksum ของไฟล์ไม่ตรงกับ snapshot ที่เก็บไว้ กรุณาเริ่ม ingestion ใหม่',
            ['ตรวจสอบไฟล์ที่อัปโหลด', 'ลบ generation เดิมและเริ่มใหม่']
          );
        }
        if (
          !force &&
          existing.status === 'ACTIVE' &&
          existing.attachmentChecksumSnapshot === attachment.checksum
        ) {
          return existing;
        }
      }

      const generation = this.generationRepository.create({
        generationUuid: uuidv7(),
        attachmentUuid: attachmentPublicId,
        attachmentChecksumSnapshot: attachment.checksum,
        status: 'BUILDING',
      });
      return await this.generationRepository.save(generation);
    } finally {
      await lock.release();
    }
  }

  /** บันทึก checksum verification ก่อนอนุญาตให้ activate */
  public async markVerified(
    generationUuid: string,
    verifiedChecksum: string
  ): Promise<void> {
    return this.stateService.markVerified(generationUuid, verifiedChecksum);
  }

  /** เปลี่ยน generation ใหม่เป็น ACTIVE และ retire generation เดิมใน transaction */
  public async activate(generationUuid: string): Promise<void> {
    return this.stateService.activate(generationUuid);
  }

  /** บันทึก failure ของ generation โดยไม่เปิดเผย technical detail ให้ผู้ใช้ */
  public async markFailed(
    generationUuid: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    return this.stateService.markFailed(
      generationUuid,
      errorCode,
      errorMessage
    );
  }

  /** คืนสถานะ generation ล่าสุดของ Attachment และจำนวน chunks ที่สร้างแล้ว */
  public async getStatus(attachmentPublicId: string): Promise<{
    attachmentPublicId: string;
    status: RagGenerationStatus | 'NOT_STARTED';
    chunkCount: number;
    indexedAt?: Date;
    lastError?: string;
  }> {
    return this.stateService.getStatus(attachmentPublicId);
  }

  /** ตรวจสอบว่า checksum มีความยาวที่ถูกต้อง (64 hex chars) */
  public isValidChecksum(checksum: string): boolean {
    return (
      checksum.length === RagAttachmentIngestionService.CHECKSUM_LENGTH &&
      /^[0-9a-f]+$/.test(checksum)
    );
  }

  /** สร้าง ValidationException สำหรับ checksum ที่ไม่พร้อม */
  public checksumRequiredError(
    attachmentPublicId: string
  ): ValidationException {
    return this.errorService.checksumRequired(attachmentPublicId);
  }
}
