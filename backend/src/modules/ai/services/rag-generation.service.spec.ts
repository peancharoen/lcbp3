// File: backend/src/modules/ai/services/rag-generation.service.spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม regression tests สำหรับ RAG generation lifecycle (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagGenerationService } from './rag-generation.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagErrorService } from './rag-error.service';

describe('RagGenerationService', () => {
  let service: RagGenerationService;
  const attachmentRepository = { findOne: jest.fn() };
  const generationRepository = {
    findOne: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const chunkRepository = { count: jest.fn().mockResolvedValue(0) };
  const lock = { release: jest.fn().mockResolvedValue(undefined) };
  const lockService = { acquire: jest.fn().mockResolvedValue(lock) };
  const errorService = new RagErrorService();
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: attachmentRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: chunkRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: RagGenerationLockService, useValue: lockService },
        { provide: RagErrorService, useValue: errorService },
      ],
    }).compile();
    service = module.get<RagGenerationService>(RagGenerationService);
  });

  it('rejects ingestion when Attachment checksum is missing', async () => {
    attachmentRepository.findOne.mockResolvedValue({ publicId: 'att-1' });

    await expect(
      service.createBuildingGeneration('att-1')
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(generationRepository.create).not.toHaveBeenCalled();
  });

  it('reuses the ACTIVE generation when checksum is unchanged', async () => {
    const active = {
      generationUuid: 'gen-1',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    };
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'a'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue(active);

    await expect(service.createBuildingGeneration('att-1')).resolves.toBe(
      active
    );
    expect(generationRepository.create).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });

  it('creates a new BUILDING generation when force is true', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'b'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-old',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'b'.repeat(64),
    });
    generationRepository.save.mockImplementation((value: unknown) =>
      Promise.resolve(value)
    );

    const result = await service.createBuildingGeneration('att-1', true);

    expect(result).toMatchObject({
      attachmentUuid: 'att-1',
      attachmentChecksumSnapshot: 'b'.repeat(64),
      status: 'BUILDING',
    });
    expect(generationRepository.save).toHaveBeenCalled();
  });

  it('marks a generation FAILED when verified checksum mismatches', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      status: 'BUILDING',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });

    await service.markVerified('gen-1', 'b'.repeat(64));

    expect(generationRepository.update).toHaveBeenCalledWith(
      { generationUuid: 'gen-1' },
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'CHECKSUM_MISMATCH',
      })
    );
  });
});
