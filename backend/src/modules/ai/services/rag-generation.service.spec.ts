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
  const attachmentRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
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

  // --- Additional tests for coverage gap ---

  it('throws when attachment is not found during createBuildingGeneration', async () => {
    attachmentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createBuildingGeneration('att-missing')
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(generationRepository.create).not.toHaveBeenCalled();
  });

  it('creates new BUILDING when force=true with existing ACTIVE', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'a'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-old',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });
    generationRepository.save.mockImplementation((value: unknown) =>
      Promise.resolve(value)
    );

    const result = await service.createBuildingGeneration('att-1', true);

    expect(result).toMatchObject({
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    expect(generationRepository.save).toHaveBeenCalled();
  });

  it('creates new BUILDING when checksum differs from ACTIVE', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'b'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-old',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });
    generationRepository.save.mockImplementation((value: unknown) =>
      Promise.resolve(value)
    );

    const result = await service.createBuildingGeneration('att-1');

    expect(result).toMatchObject({
      attachmentUuid: 'att-1',
      attachmentChecksumSnapshot: 'b'.repeat(64),
      status: 'BUILDING',
    });
  });

  it('marks verified when checksum matches the snapshot', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      status: 'BUILDING',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });

    await service.markVerified('gen-1', 'a'.repeat(64));

    expect(generationRepository.update).toHaveBeenCalledWith(
      { generationUuid: 'gen-1' },
      { verifiedContentChecksum: 'a'.repeat(64) }
    );
  });

  it('throws when generation is not found during markVerified', async () => {
    generationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.markVerified('gen-missing', 'a'.repeat(64))
    ).rejects.toMatchObject({
      code: 'RAG_GENERATION_STATE_INVALID',
    });
  });

  it('throws when generation status is not BUILDING during markVerified', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });

    await expect(
      service.markVerified('gen-1', 'a'.repeat(64))
    ).rejects.toMatchObject({
      code: 'RAG_GENERATION_STATE_INVALID',
    });
  });

  it('activates a verified BUILDING generation via transaction', async () => {
    const txGen = {
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
      verifiedContentChecksum: 'a'.repeat(64),
    };
    const txRepo = {
      findOne: jest.fn().mockResolvedValue(txGen),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (mgr: unknown) => Promise<void>) => {
        await cb({ getRepository: () => txRepo });
      }
    );

    await service.activate('gen-1');

    expect(txRepo.update).toHaveBeenCalledWith(
      { generationUuid: 'gen-1' },
      expect.objectContaining({ status: 'ACTIVE' })
    );
  });

  it('throws when generation is not found during activate', async () => {
    const txRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (mgr: unknown) => Promise<void>) => {
        await cb({ getRepository: () => txRepo });
      }
    );

    await expect(service.activate('gen-missing')).rejects.toMatchObject({
      code: 'RAG_GENERATION_STATE_INVALID',
    });
  });

  it('throws when generation is not verified during activate', async () => {
    const txRepo = {
      findOne: jest.fn().mockResolvedValue({
        generationUuid: 'gen-1',
        attachmentUuid: 'att-1',
        status: 'BUILDING',
        verifiedContentChecksum: null,
      }),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (mgr: unknown) => Promise<void>) => {
        await cb({ getRepository: () => txRepo });
      }
    );

    await expect(service.activate('gen-1')).rejects.toMatchObject({
      code: 'RAG_GENERATION_STATE_INVALID',
    });
  });

  it('marks a generation as FAILED with error code and message', async () => {
    await service.markFailed('gen-1', 'INGESTION_ERROR', 'something broke');

    expect(generationRepository.update).toHaveBeenCalledWith(
      { generationUuid: 'gen-1' },
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'INGESTION_ERROR',
        errorMessage: 'something broke',
      })
    );
  });

  it('returns NOT_STARTED status when no generation exists', async () => {
    generationRepository.findOne.mockResolvedValue(null);

    const result = await service.getStatus('att-1');

    expect(result).toEqual({
      attachmentPublicId: 'att-1',
      status: 'NOT_STARTED',
      chunkCount: 0,
    });
  });

  it('returns status and chunk count when generation exists', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      status: 'ACTIVE',
      activatedAt: new Date('2026-09-10'),
      errorMessage: undefined,
    });
    chunkRepository.count.mockResolvedValue(5);

    const result = await service.getStatus('att-1');

    expect(result).toEqual({
      attachmentPublicId: 'att-1',
      status: 'ACTIVE',
      chunkCount: 5,
      indexedAt: new Date('2026-09-10'),
      lastError: undefined,
    });
  });

  it('overrideClassification updates attachment classification', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      classification: 'INTERNAL',
    });

    await service.overrideClassification('att-1', 'CONFIDENTIAL');

    expect(attachmentRepository.update).toHaveBeenCalledWith(
      { publicId: 'att-1' },
      { classification: 'CONFIDENTIAL' }
    );
  });

  it('overrideClassification throws when attachment not found', async () => {
    attachmentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.overrideClassification('att-missing', 'PUBLIC')
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
