// File: backend/src/modules/ai/services/rag-generation-state.service.ts
// Change Log:
// - 2026-09-10: Extract shared generation state methods (markVerified, activate, markFailed, getStatus) จาก RagGenerationService และ RagAttachmentIngestionService (Feature 254 code review)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagErrorService } from './rag-error.service';
import { RagGenerationStatus } from '../interfaces/rag-attachment.types';

/**
 * Shared service สำหรับ generation state transitions
 * — markVerified, activate, markFailed, getStatus
 * ใช้โดยทั้ง RagGenerationService และ RagAttachmentIngestionService
 */
@Injectable()
export class RagGenerationStateService {
  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    private readonly dataSource: DataSource,
    private readonly errorService: RagErrorService
  ) {}

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
}
