// File: backend/src/modules/migration/migration.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation
// - 2026-08-07: Added enrichWithAttachments tests via getQueueItemById (Feature 242, FR-005)
// - 2026-08-17: Added ConfigService mock for path traversal guard (Issue #3, ADR-016)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImportTransaction } from './entities/import-transaction.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { DataSource } from 'typeorm';
import { MigrationReviewQueue } from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';

describe('MigrationService', () => {
  let service: MigrationService;

  const mockTransactionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTypeRepo = {
    findOne: jest.fn(),
  };

  const mockStatusRepo = {
    findOne: jest.fn(),
  };

  const mockProjectRepo = {
    findOne: jest.fn(),
  };

  const mockReviewQueueRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMigrationErrorRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAttachmentFind = jest.fn();

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    manager: {
      find: mockAttachmentFind,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: mockTypeRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: mockStatusRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: mockReviewQueueRepo,
        },
        {
          provide: getRepositoryToken(MigrationError),
          useValue: mockMigrationErrorRepo,
        },
        {
          provide: FileStorageService,
          useValue: { importStagingFile: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enrichWithAttachments (FR-005, Feature 242)', () => {
    it('enriches queue item with attachments[] from tempAttachmentIds', async () => {
      const queueItem = {
        id: 1,
        publicId: 'queue-uuid-001',
        tempAttachmentIds: [10, 20],
        tempAttachmentId: null,
      } as unknown as MigrationReviewQueue;

      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockAttachmentFind.mockResolvedValue([
        {
          id: 10,
          publicId: 'att-uuid-010',
          originalFilename: 'doc1.pdf',
          mimeType: 'application/pdf',
          ocrText: 'OCR text content',
        },
        {
          id: 20,
          publicId: 'att-uuid-020',
          originalFilename: 'doc2.pdf',
          mimeType: 'application/pdf',
          ocrText: null,
        },
      ]);

      const result = await service.getQueueItemById(1);

      expect(result).toBeDefined();
      // attachments should be enriched in details
      const details = (
        result as MigrationReviewQueue & {
          details: { attachments: unknown[] };
        }
      ).details;
      expect(details).toBeDefined();
      expect(details.attachments).toHaveLength(2);
      // first attachment is main document
      const att0 = details.attachments[0] as {
        publicId: string;
        isMainDocument: boolean;
        hasOcrText: boolean;
      };
      expect(att0.publicId).toBe('att-uuid-010');
      expect(att0.isMainDocument).toBe(true);
      expect(att0.hasOcrText).toBe(true);
      // second is not main
      const att1 = details.attachments[1] as {
        isMainDocument: boolean;
        hasOcrText: boolean;
      };
      expect(att1.isMainDocument).toBe(false);
      expect(att1.hasOcrText).toBe(false);
    });

    it('falls back to tempAttachmentId when tempAttachmentIds is null (R4)', async () => {
      const queueItem = {
        id: 2,
        publicId: 'queue-uuid-002',
        tempAttachmentIds: null,
        tempAttachmentId: 42,
      } as unknown as MigrationReviewQueue;

      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockAttachmentFind.mockResolvedValue([
        {
          id: 42,
          publicId: 'att-uuid-042',
          originalFilename: 'legacy.pdf',
          mimeType: 'application/pdf',
          ocrText: 'text',
        },
      ]);

      const result = await service.getQueueItemById(2);

      const details = (
        result as MigrationReviewQueue & {
          details: { attachments: unknown[] };
        }
      ).details;
      expect(details.attachments).toHaveLength(1);
      expect((details.attachments[0] as { publicId: string }).publicId).toBe(
        'att-uuid-042'
      );
    });

    it('returns item without attachments when no attachment IDs', async () => {
      const queueItem = {
        id: 3,
        publicId: 'queue-uuid-003',
        tempAttachmentIds: null,
        tempAttachmentId: null,
      } as unknown as MigrationReviewQueue;

      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);

      const result = await service.getQueueItemById(3);

      expect(result).toBeDefined();
      // No DB query for attachments since no IDs
      expect(mockAttachmentFind).not.toHaveBeenCalled();
    });

    it('handles empty tempAttachmentIds array', async () => {
      const queueItem = {
        id: 4,
        publicId: 'queue-uuid-004',
        tempAttachmentIds: [],
        tempAttachmentId: 99,
      } as unknown as MigrationReviewQueue;

      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockAttachmentFind.mockResolvedValue([
        {
          id: 99,
          publicId: 'att-uuid-099',
          originalFilename: 'fallback.pdf',
          mimeType: 'application/pdf',
          ocrText: null,
        },
      ]);

      const result = await service.getQueueItemById(4);

      const details = (
        result as MigrationReviewQueue & {
          details: { attachments: unknown[] };
        }
      ).details;
      // Should fall back to tempAttachmentId=99
      expect(details.attachments).toHaveLength(1);
    });

    it('throws NotFoundException when queue item does not exist', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);

      await expect(service.getQueueItemById(999)).rejects.toThrow();
    });
  });
});
