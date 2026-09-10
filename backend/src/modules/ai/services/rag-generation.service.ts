// File: backend/src/modules/ai/services/rag-generation.service.ts
// Change Log:
// - 2026-09-10: Delegate markVerified/activate/markFailed/getStatus to RagGenerationStateService (Feature 254 code review)
// - 2026-09-09: เพิ่ม service สำหรับสร้างและเปลี่ยนสถานะ RAG generation (Feature 254)

import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagErrorService } from './rag-error.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagGenerationStateService } from './rag-generation-state.service';
import { RagGenerationStatus } from '../interfaces/rag-attachment.types';
import { AiQdrantService } from '../qdrant.service';

/** Service สำหรับ checksum-bound RAG generation lifecycle */
@Injectable()
export class RagGenerationService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    private readonly lockService: RagGenerationLockService,
    private readonly errorService: RagErrorService,
    private readonly stateService: RagGenerationStateService,
    @Optional()
    private readonly qdrantService?: AiQdrantService
  ) {}

  /** สร้าง generation สถานะ BUILDING หลังตรวจ checksum ของ Attachment */
  public async createBuildingGeneration(
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

      const active = await this.generationRepository.findOne({
        where: { attachmentUuid: attachmentPublicId, status: 'ACTIVE' },
      });
      if (
        !force &&
        active?.attachmentChecksumSnapshot === attachment.checksum
      ) {
        return active;
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

  /** เปลี่ยน classification ของ Attachment (Superadmin override) */
  public async overrideClassification(
    attachmentPublicId: string,
    newClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'
  ): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw this.errorService.attachmentNotFound(attachmentPublicId);
    }
    await this.attachmentRepository.update(
      { publicId: attachmentPublicId },
      { classification: newClassification }
    );

    // Sync classification metadata ไปยัง Qdrant payload (T070, ADR-023)
    if (this.qdrantService) {
      await this.qdrantService.updateClassificationMetadata(
        attachmentPublicId,
        newClassification
      );
    }
  }
}
