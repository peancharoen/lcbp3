// File: backend/src/modules/ai/services/rag-generation-state.service.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม unit tests สำหรับ shared RagGenerationStateService (Feature 254 code review)

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagGenerationStateService } from './rag-generation-state.service';
import { RagErrorService } from './rag-error.service';

describe('RagGenerationStateService', () => {
  let service: RagGenerationStateService;
  const generationRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const chunkRepository = { count: jest.fn().mockResolvedValue(0) };
  const errorService = new RagErrorService();
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationStateService,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: chunkRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: RagErrorService, useValue: errorService },
      ],
    }).compile();
    service = module.get<RagGenerationStateService>(RagGenerationStateService);
  });

  describe('markVerified', () => {
    it('updates verifiedContentChecksum when checksum matches snapshot', async () => {
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

    it('throws when generation is not found', async () => {
      generationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markVerified('gen-missing', 'a'.repeat(64))
      ).rejects.toMatchObject({
        code: 'RAG_GENERATION_STATE_INVALID',
      });
    });

    it('throws when generation status is not BUILDING', async () => {
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

    it('marks FAILED when verified checksum does not match snapshot', async () => {
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

  describe('activate', () => {
    it('activates a verified BUILDING generation via transaction', async () => {
      const txRepo = {
        findOne: jest.fn().mockResolvedValue({
          generationUuid: 'gen-1',
          attachmentUuid: 'att-1',
          status: 'BUILDING',
          verifiedContentChecksum: 'a'.repeat(64),
        }),
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

    it('throws when generation status is not BUILDING during activate', async () => {
      const txRepo = {
        findOne: jest.fn().mockResolvedValue({
          generationUuid: 'gen-1',
          status: 'ACTIVE',
          attachmentChecksumSnapshot: 'e'.repeat(64),
          verifiedContentChecksum: 'e'.repeat(64),
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
  });

  describe('markFailed', () => {
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
  });

  describe('getStatus', () => {
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
  });
});
