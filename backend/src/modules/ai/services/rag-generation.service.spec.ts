// File: backend/src/modules/ai/services/rag-generation.service.spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม regression tests สำหรับ RAG generation lifecycle (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagGenerationService } from './rag-generation.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagGenerationStateService } from './rag-generation-state.service';
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
  const lock = { release: jest.fn().mockResolvedValue(undefined) };
  const lockService = { acquire: jest.fn().mockResolvedValue(lock) };
  const errorService = new RagErrorService();
  const stateService = {
    markVerified: jest.fn().mockResolvedValue(undefined),
    activate: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn(),
  };

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
        { provide: RagGenerationLockService, useValue: lockService },
        { provide: RagErrorService, useValue: errorService },
        { provide: RagGenerationStateService, useValue: stateService },
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

  it('delegates markVerified to stateService', async () => {
    await service.markVerified('gen-1', 'a'.repeat(64));
    expect(stateService.markVerified).toHaveBeenCalledWith(
      'gen-1',
      'a'.repeat(64)
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

  it('delegates activate to stateService', async () => {
    await service.activate('gen-1');
    expect(stateService.activate).toHaveBeenCalledWith('gen-1');
  });

  it('delegates markFailed to stateService', async () => {
    await service.markFailed('gen-1', 'INGESTION_ERROR', 'something broke');
    expect(stateService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'INGESTION_ERROR',
      'something broke'
    );
  });

  it('delegates getStatus to stateService', async () => {
    stateService.getStatus.mockResolvedValue({
      attachmentPublicId: 'att-1',
      status: 'ACTIVE',
      chunkCount: 5,
    });
    const result = await service.getStatus('att-1');
    expect(stateService.getStatus).toHaveBeenCalledWith('att-1');
    expect(result).toEqual({
      attachmentPublicId: 'att-1',
      status: 'ACTIVE',
      chunkCount: 5,
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
