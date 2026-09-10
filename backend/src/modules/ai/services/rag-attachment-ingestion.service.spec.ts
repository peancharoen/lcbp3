// File: backend/src/modules/ai/services/rag-attachment-ingestion.service.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม RED unit tests สำหรับ checksum readiness และ mismatch handling (Feature 254, T020)

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentIngestionService } from './rag-attachment-ingestion.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagGenerationStateService } from './rag-generation-state.service';
import { RagErrorService } from './rag-error.service';

describe('RagAttachmentIngestionService', () => {
  let service: RagAttachmentIngestionService;
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
        RagAttachmentIngestionService,
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
        { provide: RagGenerationStateService, useValue: stateService },
      ],
    }).compile();
    service = module.get<RagAttachmentIngestionService>(
      RagAttachmentIngestionService
    );
  });

  // 1. checksum readiness guard — Attachment ยังไม่มี checksum ต้องปฏิเสธการ ingest
  it('throws when Attachment has no checksum (checksum readiness guard)', async () => {
    attachmentRepository.findOne.mockResolvedValue({ publicId: 'att-1' });

    await expect(service.ingest('att-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(generationRepository.create).not.toHaveBeenCalled();
  });

  // 2. mismatch handling — checksum ปัจจุบันของ Attachment ไม่ตรง snapshot ที่เก็บไว้
  it('throws when Attachment checksum does not match the stored snapshot (mismatch handling)', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'b'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      status: 'BUILDING',
      attachmentChecksumSnapshot: 'a'.repeat(64),
    });

    await expect(service.ingest('att-1')).rejects.toMatchObject({
      code: 'CHECKSUM_MISMATCH',
    });
    expect(generationRepository.save).not.toHaveBeenCalled();
  });

  // 3. checksum ถูกต้องและไม่มี active generation → สร้าง BUILDING generation ใหม่
  it('creates a BUILDING generation when checksum is valid and no active generation exists', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'c'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue(null);
    generationRepository.save.mockImplementation((value: unknown) =>
      Promise.resolve(value)
    );

    const result = await service.ingest('att-1');

    expect(result).toMatchObject({
      attachmentUuid: 'att-1',
      attachmentChecksumSnapshot: 'c'.repeat(64),
      status: 'BUILDING',
    });
    expect(generationRepository.create).toHaveBeenCalled();
    expect(generationRepository.save).toHaveBeenCalled();
  });

  // 4. idempotent path — checksum ตรงกับ ACTIVE generation ที่มีอยู่ → ใช้ generation เดิม
  it('reuses existing ACTIVE generation when checksum matches (idempotent path)', async () => {
    const active = {
      generationUuid: 'gen-1',
      status: 'ACTIVE',
      attachmentChecksumSnapshot: 'd'.repeat(64),
    };
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      checksum: 'd'.repeat(64),
    });
    generationRepository.findOne.mockResolvedValue(active);

    await expect(service.ingest('att-1')).resolves.toBe(active);
    expect(generationRepository.create).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });

  // 5. activate — delegate ไปยัง stateService
  it('delegates activate to stateService', async () => {
    await service.activate('gen-1');
    expect(stateService.activate).toHaveBeenCalledWith('gen-1');
  });

  // 6. markVerified — delegate ไปยัง stateService
  it('delegates markVerified to stateService', async () => {
    await service.markVerified('gen-1', 'a'.repeat(64));
    expect(stateService.markVerified).toHaveBeenCalledWith(
      'gen-1',
      'a'.repeat(64)
    );
  });

  // 7. markFailed — delegate ไปยัง stateService
  it('delegates markFailed to stateService', async () => {
    await service.markFailed('gen-1', 'INGESTION_ERROR', 'something broke');
    expect(stateService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'INGESTION_ERROR',
      'something broke'
    );
  });

  // 8. getStatus — delegate ไปยัง stateService
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

  // 9. isValidChecksum — ตรวจความยาว 64 hex chars
  it('validates a correct 64-char hex checksum', () => {
    expect(service.isValidChecksum('a'.repeat(64))).toBe(true);
  });

  // 10. isValidChecksum — ปฏิเสธ checksum ที่สั้นเกินไป
  it('rejects a checksum that is too short', () => {
    expect(service.isValidChecksum('abc')).toBe(false);
  });

  // 11. isValidChecksum — ปฏิเสธ checksum ที่มี non-hex chars
  it('rejects a checksum with non-hex characters', () => {
    expect(service.isValidChecksum('g'.repeat(64))).toBe(false);
  });

  // 18. checksumRequiredError — สร้าง ValidationException
  it('returns a ValidationException from checksumRequiredError', () => {
    const error = service.checksumRequiredError('att-1');
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  // 19. ingest — throws เมื่อ attachment ไม่พบ
  it('throws when attachment is not found during ingest', async () => {
    attachmentRepository.findOne.mockResolvedValue(null);

    await expect(service.ingest('att-missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // 20. ingest — สร้าง BUILDING ใหม่เมื่อมี existing ACTIVE แต่ force=true
  it('creates new BUILDING when force=true even with ACTIVE existing', async () => {
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

    const result = await service.ingest('att-1', true);

    expect(result).toMatchObject({
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    expect(generationRepository.save).toHaveBeenCalled();
  });
});
