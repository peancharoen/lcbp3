// File: backend/src/modules/ai/services/rag-cleanup.service.ts
// Change Log:
// - 2026-09-09: เพิ่ม service สำหรับ cleanup RETIRED generations และ stale vectors (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { AiQdrantService } from '../qdrant.service';

/** บริการสำหรับ cleanup RETIRED generations และ stale Qdrant vectors */
@Injectable()
export class RagCleanupService {
  private readonly logger = new Logger(RagCleanupService.name);

  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepository: Repository<RagAttachmentPage>,
    private readonly qdrantService: AiQdrantService
  ) {}

  /**
   * Scheduled cleanup ของ RETIRED generations ทุกชั่วโมง
   * ลบ generations ที่ retired เกิน 24 ชั่วโมง พร้อม Qdrant vectors
   */
  @Cron('0 0 * * * *')
  public async scheduledCleanup(): Promise<void> {
    this.logger.log('Starting scheduled RETIRED generation cleanup...');
    try {
      const result = await this.cleanupRetiredGenerations(24);
      this.logger.log(
        `Scheduled cleanup done — generations=${result.cleanedGenerations}, chunks=${result.deletedChunks}, failed=${result.failedCleanups}`
      );
    } catch (err: unknown) {
      this.logger.error(
        `Scheduled cleanup failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Cleanup RETIRED generations ที่เก่ากว่า retentionThreshold
   * ลบ Qdrant vectors ก่อน แล้วลบ chunks/pages จาก MariaDB
   */
  public async cleanupRetiredGenerations(retentionHours = 24): Promise<{
    cleanedGenerations: number;
    deletedChunks: number;
    deletedPages: number;
    failedCleanups: number;
  }> {
    const threshold = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const retiredGenerations = await this.generationRepository.find({
      where: {
        status: 'RETIRED' as never,
        retiredAt: LessThan(threshold),
      },
      take: 50,
    });

    if (retiredGenerations.length === 0) {
      return {
        cleanedGenerations: 0,
        deletedChunks: 0,
        deletedPages: 0,
        failedCleanups: 0,
      };
    }

    let cleanedGenerations = 0;
    let deletedChunks = 0;
    let deletedPages = 0;
    let failedCleanups = 0;

    for (const generation of retiredGenerations) {
      try {
        // 1. ลบ Qdrant vectors ของ generation นี้
        await this.deleteQdrantVectorsByGeneration(generation.generationUuid);

        // 2. ลบ chunks จาก MariaDB
        const chunkResult = await this.chunkRepository.delete({
          generationUuid: generation.generationUuid,
        });
        deletedChunks += chunkResult.affected ?? 0;

        // 3. ลบ pages จาก MariaDB
        const pageResult = await this.pageRepository.delete({
          generationUuid: generation.generationUuid,
        });
        deletedPages += pageResult.affected ?? 0;

        // 4. ลบ generation record
        await this.generationRepository.delete({
          generationUuid: generation.generationUuid,
        });
        cleanedGenerations += 1;
      } catch (err: unknown) {
        failedCleanups += 1;
        this.logger.error(
          `Failed to cleanup RETIRED generation ${generation.generationUuid}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    this.logger.log(
      `Cleanup complete — generations=${cleanedGenerations}, chunks=${deletedChunks}, pages=${deletedPages}, failed=${failedCleanups}`
    );
    return {
      cleanedGenerations,
      deletedChunks,
      deletedPages,
      failedCleanups,
    };
  }

  /** ลบ Qdrant vectors โดยใช้ chunk public IDs ของ generation */
  private async deleteQdrantVectorsByGeneration(
    generationUuid: string
  ): Promise<void> {
    try {
      const chunks = await this.chunkRepository.find({
        where: { generationUuid },
        select: ['chunkPublicId'],
      });
      if (chunks.length === 0) return;

      const pointIds = chunks.map((c) => c.chunkPublicId);
      await this.qdrantService.deleteByPointIds(pointIds);
      this.logger.debug(
        `Deleted ${pointIds.length} Qdrant vectors for generation ${generationUuid}`
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to delete Qdrant vectors for generation ${generationUuid}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
