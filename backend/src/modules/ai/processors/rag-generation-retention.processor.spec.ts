// File: backend/src/modules/ai/processors/rag-generation-retention.processor.spec.ts
// Change Log:
// - 2026-09-14: T062 — เพิ่ม unit tests สำหรับ RagGenerationRetentionProcessor (Feature 254, Phase 5 US3)
//   ครอบคลุม FAILED generation purge, scheduler, และ error handling

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { RagGenerationRetentionProcessor } from './rag-generation-retention.processor';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { AiQdrantService } from '../qdrant.service';
import { RagObservabilityService } from '../services/rag-observability.service';
import { QUEUE_AI_RAG_GENERATION_RETENTION } from '../../common/constants/queue.constants';

/** สร้าง mock BullMQ Job สำหรับ retention cleanup */
function makeJob(
  overrides: { batchSize?: number } = {}
): Job<{ batchSize?: number }> {
  return {
    id: 'job-retention-001',
    data: { batchSize: overrides.batchSize },
  } as unknown as Job<{ batchSize?: number }>;
}

/** สร้าง mock FAILED generation record ที่เก่ากว่า 30 วัน */
function makeFailedGeneration(
  generationUuid = 'gen-failed-001'
): RagAttachmentGeneration {
  return {
    generationUuid,
    attachmentUuid: 'att-uuid-001',
    attachmentChecksumSnapshot: 'sha256-abc',
    status: 'FAILED',
    embeddingModel: 'bge-m3',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    failedAt: new Date('2026-07-02T00:00:00.000Z'),
  } as RagAttachmentGeneration;
}

describe('RagGenerationRetentionProcessor', () => {
  let processor: RagGenerationRetentionProcessor;
  let generationRepo: jest.Mocked<Repository<RagAttachmentGeneration>>;
  let chunkRepo: jest.Mocked<Repository<RagAttachmentChunk>>;
  let pageRepo: jest.Mocked<Repository<RagAttachmentPage>>;
  let qdrantService: jest.Mocked<AiQdrantService>;
  let retentionQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationRetentionProcessor,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: {
            find: jest.fn(),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: {
            find: jest.fn(),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(RagAttachmentPage),
          useValue: {
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: AiQdrantService,
          useValue: {
            deleteByPointIds: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getQueueToken(QUEUE_AI_RAG_GENERATION_RETENTION),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
          },
        },
        {
          provide: RagObservabilityService,
          useValue: {
            recordQdrantDeletionAttempted: jest.fn(),
            recordQdrantDeletionSucceeded: jest.fn(),
            recordQdrantPartialFailure: jest.fn(),
          },
        },
      ],
    }).compile();
    processor = module.get(RagGenerationRetentionProcessor);
    generationRepo = module.get(getRepositoryToken(RagAttachmentGeneration));
    chunkRepo = module.get(getRepositoryToken(RagAttachmentChunk));
    pageRepo = module.get(getRepositoryToken(RagAttachmentPage));
    qdrantService = module.get(AiQdrantService);
    retentionQueue = module.get(
      getQueueToken(QUEUE_AI_RAG_GENERATION_RETENTION)
    );
  });

  describe('process — FAILED generation purge', () => {
    it('ควร purge FAILED generations ที่เก่ากว่า 30 วัน', async () => {
      const failedGen = makeFailedGeneration('gen-failed-001');
      generationRepo.find.mockResolvedValue([failedGen]);
      chunkRepo.find.mockResolvedValue([
        { chunkPublicId: 'chunk-001' },
        { chunkPublicId: 'chunk-002' },
      ]);

      await processor.process(makeJob());

      expect(generationRepo.find).toHaveBeenCalled();
      expect(chunkRepo.find).toHaveBeenCalledWith({
        where: { generationUuid: 'gen-failed-001' },
        select: ['chunkPublicId'],
      });
      expect(qdrantService.deleteByPointIds).toHaveBeenCalledWith([
        'chunk-001',
        'chunk-002',
      ]);
      expect(chunkRepo.delete).toHaveBeenCalledWith({
        generationUuid: 'gen-failed-001',
      });
      expect(pageRepo.delete).toHaveBeenCalledWith({
        generationUuid: 'gen-failed-001',
      });
      expect(generationRepo.delete).toHaveBeenCalledWith({
        generationUuid: 'gen-failed-001',
      });
    });

    it('ควร return early เมื่อไม่มี FAILED generations', async () => {
      generationRepo.find.mockResolvedValue([]);

      await processor.process(makeJob());

      expect(generationRepo.find).toHaveBeenCalled();
      expect(chunkRepo.delete).not.toHaveBeenCalled();
      expect(qdrantService.deleteByPointIds).not.toHaveBeenCalled();
    });

    it('ควรใช้ batchSize จาก job payload (default 100)', async () => {
      generationRepo.find.mockResolvedValue([]);

      await processor.process(makeJob({ batchSize: 50 }));

      expect(generationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('ควร continue purge รายอื่นเมื่อบาง generation purge ล้มเหลว', async () => {
      const gen1 = makeFailedGeneration('gen-failed-001');
      const gen2 = makeFailedGeneration('gen-failed-002');
      generationRepo.find.mockResolvedValue([gen1, gen2]);
      chunkRepo.find
        .mockResolvedValueOnce([{ chunkPublicId: 'chunk-001' }])
        .mockResolvedValueOnce([{ chunkPublicId: 'chunk-002' }]);
      qdrantService.deleteByPointIds
        .mockRejectedValueOnce(new Error('Qdrant down'))
        .mockResolvedValueOnce(undefined);

      await processor.process(makeJob());

      // ทั้งสองถูก attempt
      expect(qdrantService.deleteByPointIds).toHaveBeenCalledTimes(2);
      // gen2 DB cleanup ยังทำงาน
      expect(generationRepo.delete).toHaveBeenCalledWith({
        generationUuid: 'gen-failed-002',
      });
    });
  });

  describe('scheduleRetentionCleanup — daily scheduler', () => {
    it('ควร enqueue job ไปยัง retention queue', async () => {
      await processor.scheduleRetentionCleanup();

      expect(retentionQueue.add).toHaveBeenCalledWith(
        'rag-generation-retention',
        { batchSize: 100 },
        expect.objectContaining({
          removeOnComplete: 100,
          removeOnFail: 50,
        })
      );
    });

    it('ควรใช้ jobId ตามวันที่ (idempotent ต่อวัน)', async () => {
      await processor.scheduleRetentionCleanup();

      const callArgs = retentionQueue.add.mock.calls[0];
      const opts = callArgs[2] as { jobId: string };
      expect(opts.jobId).toMatch(/^retention-\d{4}-\d{2}-\d{2}$/);
    });

    it('ควร log error เมื่อ enqueue ล้มเหลว แตะไม่ throw', async () => {
      retentionQueue.add.mockRejectedValueOnce(new Error('Redis down'));

      await expect(processor.scheduleRetentionCleanup()).resolves.not.toThrow();
    });
  });
});
