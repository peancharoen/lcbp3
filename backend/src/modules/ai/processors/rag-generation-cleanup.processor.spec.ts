// File: backend/src/modules/ai/processors/rag-generation-cleanup.processor.spec.ts
// Change Log:
// - 2026-09-10: T047 — เพิ่ม RED tests สำหรับ RagGenerationCleanupProcessor (Feature 254, Phase 5 US3)
//   ครอบคลุม RETIRED cleanup retry, pending vector deletion, และ safety guard

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { RagGenerationCleanupProcessor } from './rag-generation-cleanup.processor';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import {
  PendingVectorDeletion,
  PendingVectorDeletionStatus,
} from '../entities/pending-vector-deletion.entity';
import { AiQdrantService } from '../qdrant.service';
import type { RagGenerationCleanupJobPayload } from '../ai-queue.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** สร้าง mock BullMQ Job สำหรับ RETIRED generation cleanup */
function makeJob(
  overrides: Partial<RagGenerationCleanupJobPayload> = {}
): Job<RagGenerationCleanupJobPayload> {
  return {
    id: 'job-cleanup-001',
    data: {
      generationUuid: overrides.generationUuid ?? 'gen-uuid-001',
      attachmentPublicId: overrides.attachmentPublicId ?? 'att-uuid-001',
      projectPublicId: overrides.projectPublicId ?? 'proj-uuid-001',
    },
  } as unknown as Job<RagGenerationCleanupJobPayload>;
}

/** สร้าง mock RETIRED generation record */
function makeRetiredGeneration(
  generationUuid = 'gen-uuid-001'
): RagAttachmentGeneration {
  return {
    generationUuid,
    attachmentUuid: 'att-uuid-001',
    attachmentChecksumSnapshot: 'sha256-abc',
    status: 'RETIRED',
    embeddingModel: 'bge-m3',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    activatedAt: new Date('2026-09-01T01:00:00.000Z'),
    retiredAt: new Date('2026-09-02T00:00:00.000Z'),
  } as RagAttachmentGeneration;
}

/** สร้าง mock ACTIVE generation record (non-RETIRED) */
function makeActiveGeneration(
  generationUuid = 'gen-uuid-active'
): RagAttachmentGeneration {
  return {
    generationUuid,
    attachmentUuid: 'att-uuid-001',
    attachmentChecksumSnapshot: 'sha256-abc',
    status: 'ACTIVE',
    embeddingModel: 'bge-m3',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    activatedAt: new Date('2026-09-01T01:00:00.000Z'),
  } as RagAttachmentGeneration;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RagGenerationCleanupProcessor', () => {
  let processor: RagGenerationCleanupProcessor;
  let generationRepo: jest.Mocked<Repository<RagAttachmentGeneration>>;
  let chunkRepo: jest.Mocked<Repository<RagAttachmentChunk>>;
  let pageRepo: jest.Mocked<Repository<RagAttachmentPage>>;
  let pendingRepo: jest.Mocked<Repository<PendingVectorDeletion>>;
  let qdrantService: jest.Mocked<AiQdrantService>;

  const mockGenerationRepo = {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const mockChunkRepo = {
    find: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 2 }),
  };
  const mockPageRepo = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const mockPendingRepo = {
    create: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const mockQdrantService = {
    deleteByPointIds: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationCleanupProcessor,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: mockGenerationRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: mockChunkRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentPage),
          useValue: mockPageRepo,
        },
        {
          provide: getRepositoryToken(PendingVectorDeletion),
          useValue: mockPendingRepo,
        },
        { provide: AiQdrantService, useValue: mockQdrantService },
      ],
    }).compile();

    processor = module.get<RagGenerationCleanupProcessor>(
      RagGenerationCleanupProcessor
    );
    generationRepo = module.get(getRepositoryToken(RagAttachmentGeneration));
    chunkRepo = module.get(getRepositoryToken(RagAttachmentChunk));
    pageRepo = module.get(getRepositoryToken(RagAttachmentPage));
    pendingRepo = module.get(getRepositoryToken(PendingVectorDeletion));
    qdrantService = module.get(AiQdrantService);
  });

  // ─── AC1: จัดการ RETIRED generation cleanup job ──────────────────────────

  it('ควรลบ Qdrant vectors และ DB chunks/pages สำหรับ RETIRED generation', async () => {
    const generation = makeRetiredGeneration('gen-uuid-001');
    mockGenerationRepo.findOne.mockResolvedValueOnce(generation);
    mockChunkRepo.find.mockResolvedValueOnce([
      { chunkPublicId: 'chunk-uuid-1' } as RagAttachmentChunk,
      { chunkPublicId: 'chunk-uuid-2' } as RagAttachmentChunk,
    ]);

    const job = makeJob({ generationUuid: 'gen-uuid-001' });
    await processor.process(job);

    // ลบ Qdrant vectors โดยใช้ chunk public IDs
    expect(qdrantService.deleteByPointIds).toHaveBeenCalledWith([
      'chunk-uuid-1',
      'chunk-uuid-2',
    ]);
    // ลบ chunks จาก MariaDB
    expect(chunkRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-001',
    });
    // ลบ pages จาก MariaDB
    expect(pageRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-001',
    });
    // ลบ generation record
    expect(generationRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-001',
    });
  });

  // ─── AC2: Qdrant deletion fail → job retries ──────────────────────────────

  it('ควร throw error เพื่อ trigger retry เมื่อ Qdrant deletion ล้มเหลว', async () => {
    const generation = makeRetiredGeneration('gen-uuid-fail');
    mockGenerationRepo.findOne.mockResolvedValueOnce(generation);
    mockChunkRepo.find.mockResolvedValueOnce([
      { chunkPublicId: 'chunk-uuid-1' } as RagAttachmentChunk,
    ]);
    mockQdrantService.deleteByPointIds.mockRejectedValueOnce(
      new Error('Qdrant connection refused')
    );

    const job = makeJob({ generationUuid: 'gen-uuid-fail' });
    // BullMQ retry ทำงานเมื่อ processor throw — ต้องไม่ catch ปิดไว้
    await expect(processor.process(job)).rejects.toThrow(
      'Qdrant connection refused'
    );

    // ไม่ควรลบ chunks/pages จาก DB เมื่อ Qdrant ยังไม่สำเร็จ (consistency)
    expect(chunkRepo.delete).not.toHaveBeenCalled();
    expect(pageRepo.delete).not.toHaveBeenCalled();
    expect(generationRepo.delete).not.toHaveBeenCalled();
  });

  // ─── AC3: หลัง cleanup สำเร็จ chunks ถูกลบจาก DB ─────────────────────────

  it('ควรลบ RETIRED generation chunks ออกจาก DB หลัง cleanup สำเร็จ', async () => {
    const generation = makeRetiredGeneration('gen-uuid-success');
    mockGenerationRepo.findOne.mockResolvedValueOnce(generation);
    mockChunkRepo.find.mockResolvedValueOnce([
      { chunkPublicId: 'chunk-uuid-1' } as RagAttachmentChunk,
      { chunkPublicId: 'chunk-uuid-2' } as RagAttachmentChunk,
      { chunkPublicId: 'chunk-uuid-3' } as RagAttachmentChunk,
    ]);
    mockChunkRepo.delete.mockResolvedValueOnce({ affected: 3 });

    const job = makeJob({ generationUuid: 'gen-uuid-success' });
    await processor.process(job);

    // chunks ถูกลบจาก DB ด้วย generationUuid filter
    expect(chunkRepo.delete).toHaveBeenCalledTimes(1);
    expect(chunkRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-success',
    });
    // pages ถูกลบด้วย
    expect(pageRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-success',
    });
    // generation record ถูกลบเป็นอันดับสุดท้าย
    expect(generationRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-uuid-success',
    });
  });

  // ─── AC4: Qdrant partial failure → record pending vector deletion ────────

  it('ควรบันทึก pending vector deletion เมื่อ Qdrant deletion ล้มเหลวบางส่วน', async () => {
    const generation = makeRetiredGeneration('gen-uuid-partial');
    mockGenerationRepo.findOne.mockResolvedValueOnce(generation);
    mockChunkRepo.find.mockResolvedValueOnce([
      { chunkPublicId: 'chunk-uuid-1' } as RagAttachmentChunk,
      { chunkPublicId: 'chunk-uuid-2' } as RagAttachmentChunk,
    ]);
    mockQdrantService.deleteByPointIds.mockRejectedValueOnce(
      new Error('Qdrant partial failure')
    );

    const job = makeJob({
      generationUuid: 'gen-uuid-partial',
      attachmentPublicId: 'att-uuid-partial',
      projectPublicId: 'proj-uuid-partial',
    });
    await expect(processor.process(job)).rejects.toThrow(
      'Qdrant partial failure'
    );

    // บันทึก pending vector deletion เพื่อ retry ภายหลัง (compensation pattern)
    expect(pendingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        documentPublicId: 'att-uuid-partial',
        projectPublicId: 'proj-uuid-partial',
        status: PendingVectorDeletionStatus.PENDING,
      })
    );
    expect(pendingRepo.save).toHaveBeenCalledTimes(1);
  });

  // ─── AC5: safety guard — skip non-RETIRED generations ────────────────────

  it('ควรข้าม cleanup เมื่อ generation ไม่ใช่สถานะ RETIRED (safety guard)', async () => {
    const activeGeneration = makeActiveGeneration('gen-uuid-active');
    mockGenerationRepo.findOne.mockResolvedValueOnce(activeGeneration);

    const job = makeJob({ generationUuid: 'gen-uuid-active' });
    await processor.process(job);

    // ไม่ควรลบอะไรเลยเมื่อ generation ยัง ACTIVE
    expect(qdrantService.deleteByPointIds).not.toHaveBeenCalled();
    expect(chunkRepo.delete).not.toHaveBeenCalled();
    expect(pageRepo.delete).not.toHaveBeenCalled();
    expect(generationRepo.delete).not.toHaveBeenCalled();
  });

  it('ควรข้าม cleanup เมื่อไม่พบ generation record', async () => {
    mockGenerationRepo.findOne.mockResolvedValueOnce(null);

    const job = makeJob({ generationUuid: 'gen-uuid-missing' });
    await processor.process(job);

    expect(qdrantService.deleteByPointIds).not.toHaveBeenCalled();
    expect(chunkRepo.delete).not.toHaveBeenCalled();
    expect(generationRepo.delete).not.toHaveBeenCalled();
  });
});
