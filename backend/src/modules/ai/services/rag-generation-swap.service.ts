// File: backend/src/modules/ai/services/rag-generation-swap.service.ts
// Change Log:
// - 2026-09-11: T049 — เพิ่ม Redlock-protected build-then-swap transaction (Feature 254, Phase 5 US3)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagErrorService } from './rag-error.service';
import { RagObservabilityService } from './rag-observability.service';

/**
 * Service สำหรับ build-then-swap transaction ที่ปลอดภัย
 * ใช้ Redlock serialize การ swap BUILDING→ACTIVE และ ACTIVE→RETIRED
 * ภายใน transaction เดียวเพื่อรักษา invariant "ACTIVE generation เพียงตัวเดียว"
 */
@Injectable()
export class RagGenerationSwapService {
  private readonly logger = new Logger(RagGenerationSwapService.name);

  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    private readonly dataSource: DataSource,
    private readonly lockService: RagGenerationLockService,
    private readonly errorService: RagErrorService,
    @Optional()
    private readonly observabilityService?: RagObservabilityService
  ) {}

  /**
   * Promote BUILDING generation เป็น ACTIVE และ retire ACTIVE generation เดิม
   * ทำภายใน Redlock-protected transaction เดียวเพื่อ atomicity
   * @param generationUuid UUID ของ generation ที่จะ promote เป็น ACTIVE
   * @throws BusinessException เมื่อ generation ไม่พบหรือไม่ใช่สถานะ BUILDING
   * @throws ServiceUnavailableException เมื่อ Redlock acquire ไม่สำเร็จ
   */
  public async swapToActive(generationUuid: string): Promise<void> {
    // 1. ตรวจสอบ generation ก่อน acquire lock (fail fast ถ้าไม่พบ)
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

    // 2. State guard — ต้องเป็น BUILDING เท่านั้น (ตรวจก่อน acquire lock เพื่อไม่จอง lock โดยไม่จำเป็น)
    if (generation.status !== 'BUILDING') {
      throw this.errorService.invalidGenerationState(
        generationUuid,
        'BUILDING',
        generation.status
      );
    }

    // 3. Acquire Redlock สำหรับ attachment (serialize concurrent re-ingestion)
    const lock = await this.lockService.acquire(generation.attachmentUuid);
    this.observabilityService?.recordSwapStarted(generation.attachmentUuid);
    try {
      // 4. Atomic swap ใน transaction เดียว — retire old ACTIVE, promote new BUILDING→ACTIVE
      await this.dataSource.transaction(async (manager) => {
        const txRepo = manager.getRepository(RagAttachmentGeneration);

        // Retire old ACTIVE generation ของ attachment เดียวกัน
        await txRepo.update(
          { attachmentUuid: generation.attachmentUuid, status: 'ACTIVE' },
          { status: 'RETIRED' as const, retiredAt: new Date() }
        );

        // Promote new generation เป็น ACTIVE
        await txRepo.update(
          { generationUuid },
          { status: 'ACTIVE' as const, activatedAt: new Date() }
        );
      });

      // 5. Invariant check — หลัง swap ต้องมี ACTIVE generation เพียงตัวเดียว
      const activeGenerations = await this.generationRepository.find({
        where: {
          attachmentUuid: generation.attachmentUuid,
          status: 'ACTIVE' as const,
        },
      });
      if (activeGenerations.length !== 1) {
        this.logger.error(
          `Post-swap invariant violated: found ${activeGenerations.length} ACTIVE generations for attachment ${generation.attachmentUuid}`
        );
      }

      this.observabilityService?.recordSwapCompleted(
        generation.attachmentUuid,
        activeGenerations.length
      );
    } catch (err: unknown) {
      this.observabilityService?.recordSwapRollback(
        generation.attachmentUuid,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    } finally {
      await lock.release();
    }
  }
}
