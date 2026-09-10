// File: backend/src/modules/ai/services/rag-generation.service.ts
// Change Log:
// - 2026-09-09: เพิ่ม service สำหรับสร้างและเปลี่ยนสถานะ RAG generation (Feature 254)

import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagErrorService } from './rag-error.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
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
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    private readonly dataSource: DataSource,
    private readonly lockService: RagGenerationLockService,
    private readonly errorService: RagErrorService,
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
    const generation = await this.generationRepository.findOne({
      where: { attachmentUuid: attachmentPublicId },
      order: { createdAt: 'DESC' },
    });
    if (!generation) {
      return { attachmentPublicId, status: 'NOT_STARTED', chunkCount: 0 };
    }
    const chunkCount = await this.chunkRepository.count({
      where: { generationUuid: generation.generationUuid },
    });
    return {
      attachmentPublicId,
      status: generation.status,
      chunkCount,
      indexedAt: generation.activatedAt,
      lastError: generation.errorMessage,
    };
  }

  /** บันทึก checksum verification ก่อนอนุญาตให้ activate */
  public async markVerified(
    generationUuid: string,
    verifiedChecksum: string
  ): Promise<void> {
    const generation = await this.generationRepository.findOne({
      where: { generationUuid },
    });
    if (!generation) {
      throw this.errorService.invalidGenerationState(
        generationUuid,
        'BUILDING',
        'NOT_FOUND'
      );
    }
    if (generation.status !== 'BUILDING') {
      throw this.errorService.invalidGenerationState(
        generationUuid,
        'BUILDING',
        generation.status
      );
    }
    if (generation.attachmentChecksumSnapshot !== verifiedChecksum) {
      await this.markFailed(
        generationUuid,
        'CHECKSUM_MISMATCH',
        'Verified content checksum does not match the Attachment snapshot'
      );
      return;
    }
    await this.generationRepository.update(
      { generationUuid },
      { verifiedContentChecksum: verifiedChecksum }
    );
  }

  /** เปลี่ยน generation ใหม่เป็น ACTIVE และ retire generation เดิมใน transaction */
  public async activate(generationUuid: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const generationRepository = manager.getRepository(
        RagAttachmentGeneration
      );
      const generation = await generationRepository.findOne({
        where: { generationUuid },
      });
      if (!generation || generation.status !== 'BUILDING') {
        throw this.errorService.invalidGenerationState(
          generationUuid,
          'BUILDING',
          generation?.status ?? 'NOT_FOUND'
        );
      }
      if (!generation.verifiedContentChecksum) {
        throw this.errorService.invalidGenerationState(
          generationUuid,
          'VERIFIED_BUILDING',
          'UNVERIFIED'
        );
      }

      await generationRepository
        .createQueryBuilder()
        .update(RagAttachmentGeneration)
        .set({ status: 'RETIRED', retiredAt: new Date() })
        .where('attachment_uuid = :attachmentUuid', {
          attachmentUuid: generation.attachmentUuid,
        })
        .andWhere('status = :status', { status: 'ACTIVE' })
        .execute();

      await generationRepository.update(
        { generationUuid },
        { status: 'ACTIVE', activatedAt: new Date() }
      );
    });
  }

  /** บันทึก failure ของ generation โดยไม่เปิดเผย technical detail ให้ผู้ใช้ */
  public async markFailed(
    generationUuid: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.generationRepository.update(
      { generationUuid },
      {
        status: 'FAILED' as RagGenerationStatus,
        errorCode,
        errorMessage,
        failedAt: new Date(),
      }
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
