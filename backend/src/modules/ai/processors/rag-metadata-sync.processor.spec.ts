// File: backend/src/modules/ai/processors/rag-metadata-sync.processor.spec.ts
// Change Log:
// - 2026-09-16: สร้าง unit test สำหรับ RagMetadataSyncProcessor (Feature 254 US5, spec 2B.8)
//   — metadata-only sync ต้องอัปเดต Qdrant payload จาก DB classification (source of truth)
//   โดยไม่ re-embed vector และต้อง skip อย่างปลอดภัยเมื่อ attachment ไม่พบ

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { RagMetadataSyncProcessor } from './rag-metadata-sync.processor';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { AiQdrantService } from '../qdrant.service';
import type { RagMetadataSyncJobPayload } from '../ai-queue.service';

/**
 * Unit tests สำหรับ RagMetadataSyncProcessor
 * ครอบคลุม: sync classification ปัจจุบันจาก DB → Qdrant payload (metadata-only,
 * ไม่ re-embed), skip เมื่อ attachment ไม่พบ, และใช้ค่า DB เป็น source of truth
 */
describe('RagMetadataSyncProcessor', () => {
  let processor: RagMetadataSyncProcessor;
  let attachmentRepo: jest.Mocked<Repository<Attachment>>;
  let qdrantService: { updateClassificationMetadata: jest.Mock };

  const makeJob = (
    payload: Partial<RagMetadataSyncJobPayload> = {}
  ): Job<RagMetadataSyncJobPayload> =>
    ({
      id: 'job-metadata-sync-001',
      data: {
        generationUuid: 'gen-uuid-001',
        attachmentPublicId: 'att-uuid-001',
        ...payload,
      },
    }) as unknown as Job<RagMetadataSyncJobPayload>;

  beforeEach(async () => {
    qdrantService = {
      updateClassificationMetadata: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagMetadataSyncProcessor,
        {
          provide: getRepositoryToken(Attachment),
          useValue: { findOne: jest.fn() },
        },
        { provide: AiQdrantService, useValue: qdrantService },
      ],
    }).compile();

    processor = module.get<RagMetadataSyncProcessor>(RagMetadataSyncProcessor);
    attachmentRepo = module.get(getRepositoryToken(Attachment));
    jest.clearAllMocks();
  });

  it('updates Qdrant payload with the current DB classification (metadata-only)', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 10,
      publicId: 'att-uuid-001',
      classification: 'LETTER',
    } as Attachment);

    await processor.process(makeJob());

    expect(attachmentRepo.findOne).toHaveBeenCalledWith({
      where: { publicId: 'att-uuid-001' },
    });
    // เขียนเฉพาะ payload — ไม่เรียก upsert/delete/recreate vector ใด ๆ
    expect(qdrantService.updateClassificationMetadata).toHaveBeenCalledTimes(1);
    expect(qdrantService.updateClassificationMetadata).toHaveBeenCalledWith(
      'att-uuid-001',
      'LETTER'
    );
  });

  it('uses the DB classification as source of truth (not job payload)', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 10,
      publicId: 'att-uuid-001',
      classification: 'RFA', // reviewer เปลี่ยน classification หลัง enqueue
    } as Attachment);

    await processor.process(makeJob());

    expect(qdrantService.updateClassificationMetadata).toHaveBeenCalledWith(
      'att-uuid-001',
      'RFA'
    );
  });

  it('skips safely when the attachment is not found — no Qdrant write, no throw', async () => {
    attachmentRepo.findOne.mockResolvedValue(null);

    await expect(
      processor.process(makeJob({ attachmentPublicId: 'att-missing' }))
    ).resolves.toBeUndefined();

    expect(qdrantService.updateClassificationMetadata).not.toHaveBeenCalled();
  });

  it('propagates Qdrant failure so BullMQ can retry the job', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 10,
      publicId: 'att-uuid-001',
      classification: 'LETTER',
    } as Attachment);
    qdrantService.updateClassificationMetadata.mockRejectedValue(
      new Error('Qdrant unavailable')
    );

    await expect(processor.process(makeJob())).rejects.toThrow(
      'Qdrant unavailable'
    );
  });
});
