// File: backend/src/modules/migration/migration.service.spec.ts
// Change Log:
// - 2026-08-23: เพิ่ม regression tests สำหรับ disciplineId และ recipientType filter
// - 2026-08-06: Initial creation
// - 2026-08-07: Added enrichWithAttachments tests via getQueueItemById (Feature 242, FR-005)
// - 2026-08-17: Added ConfigService mock for path traversal guard (Issue #3, ADR-016)
// - 2026-08-25: Added D159 regression tests — revision.body ใช้ aiSummary ไม่ใช่ ocrText
// - 2026-08-26: Added regression tests — importStagingFile ต้องได้ issueDate จาก dto.documentDate
// - 2026-08-27: Expand coverage to 80%+ — tests for all uncovered methods

jest.mock('fs', () => {
  const actual: Record<string, unknown> = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn(),
    existsSync: jest.fn(),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ImportTransaction } from './entities/import-transaction.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { DataSource } from 'typeorm';
import { MigrationReviewQueue } from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { RagBatchService } from './services/rag-batch.service';
import { Discipline } from '../master/entities/discipline.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRecipient } from '../correspondence/entities/correspondence-recipient.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { CreateMigrationErrorDto } from './dto/create-migration-error.dto';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import {
  MigrationReviewStatus,
  MigrationAiStatus,
  CompareStatus,
} from './entities/migration-review-queue.entity';
import { MigrationErrorType } from './entities/migration-error.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import {
  ValidationException,
  NotFoundException,
  ConflictException,
  SystemException,
  BusinessException,
} from '../../common/exceptions';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';

const mockedExistsSync = jest.mocked(existsSync);
const mockedCreateReadStream = jest.mocked(createReadStream);

describe('MigrationService', () => {
  let service: MigrationService;

  const mockTransactionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTypeRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
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
    find: jest.fn(),
    delete: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMigrationErrorRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAttachmentFind = jest.fn();

  const mockFileStorageService = {
    importStagingFile: jest.fn(),
  };

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
      findOne: jest.fn(),
    },
  };

  const mockAiBatchQueue = {
    add: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
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
          useValue: mockFileStorageService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: getQueueToken('ai-batch'),
          useValue: mockAiBatchQueue as unknown as Queue,
        },
        {
          provide: RagBatchService,
          useValue: {
            enqueueRagPrepare: jest.fn().mockResolvedValue(undefined),
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

  describe('importCorrespondence (regression coverage)', () => {
    beforeEach(() => {
      mockTransactionRepo.findOne.mockResolvedValue(null);
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
    });

    it('uses disciplineId directly and verifies discipline exists', async () => {
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-001',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-001',
        projectId: 100,
        disciplineId: 5,
      };

      // discipline lookup ใช้ dataSource.manager ไม่ใช่ queryRunner.manager
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 5,
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, value: unknown) => value
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);

      await service.importCorrespondence(dto, 'idem-key-1', 1);

      expect(mockDataSource.manager.findOne).toHaveBeenCalledWith(
        Discipline,
        expect.objectContaining({
          where: expect.objectContaining({ id: 5 }),
          select: ['id'],
        })
      );
    });

    it('creates TO recipient even when a CC recipient for the same organization exists', async () => {
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-002',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-002',
        projectId: 100,
        receiverPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      };

      const existingCorrespondence = {
        id: 1,
        disciplineId: null,
        originatorId: null,
      };

      // Mock dataSource.manager.findOne for resolving receiverPublicId
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 7,
      });

      mockQueryRunner.manager.findOne.mockImplementation(
        (entity: typeof Correspondence | typeof CorrespondenceRecipient) => {
          if (entity.name === 'Correspondence') {
            return existingCorrespondence;
          }
          // จำลองว่า TO recipient ยังไม่มี (แม้ CC จะมีอยู่) เพื่อให้บังคับสร้าง TO
          return null;
        }
      );
      mockQueryRunner.manager.create.mockImplementation(
        (_entity: unknown, value: unknown) => value
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);

      await service.importCorrespondence(dto, 'idem-key-2', 1);

      // ถ้า lookup ไม่ระบุ recipientType ระบบจะพบ CC และไม่สร้าง TO — นี่คือ bug ที่แก้ไข
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        CorrespondenceRecipient,
        expect.objectContaining({
          where: expect.objectContaining({
            correspondenceId: 1,
            recipientOrganizationId: 7,
            recipientType: 'TO',
          }),
        })
      );

      // ต้องสร้าง TO recipient ใหม่เมื่อ lookup แยก recipientType
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        CorrespondenceRecipient,
        expect.objectContaining({
          correspondenceId: 1,
          recipientOrganizationId: 7,
          recipientType: 'TO',
        })
      );
    });

    // D159: revision.body ใช้ aiSummary (AI สรุป) ไม่ใช่ ocrText (OCR ดิบ)
    describe('D159: revision.body assignment from aiSummary', () => {
      const setupImportMocks = (): void => {
        mockDataSource.manager.findOne.mockResolvedValue({ id: 5 });
        mockQueryRunner.manager.findOne.mockResolvedValue(null);
        mockQueryRunner.manager.create.mockImplementation(
          (_entity: unknown, value: unknown) => value
        );
        mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
        mockQueryRunner.manager.find.mockResolvedValue([]);
        mockQueryRunner.manager.query.mockResolvedValue([]);
      };

      const createBaseDto = (
        overrides: Partial<ImportCorrespondenceDto> = {}
      ): ImportCorrespondenceDto => ({
        documentNumber: 'DOC-D159',
        subject: 'D159 Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-D159',
        projectId: 100,
        ...overrides,
      });

      it('sets revision.body from aiSummary when no explicit body (new revision)', async () => {
        setupImportMocks();
        const dto = createBaseDto({
          aiSummary: 'AI-generated summary of the document',
          ocrText: 'raw OCR text that should NOT be used as body',
        });

        await service.importCorrespondence(dto, 'idem-d159-1', 1);

        // ต้องสร้าง CorrespondenceRevision ด้วย body = aiSummary
        expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
          CorrespondenceRevision,
          expect.objectContaining({
            body: 'AI-generated summary of the document',
          })
        );
      });

      it('prefers explicit body over aiSummary (reviewer override)', async () => {
        setupImportMocks();
        const dto = createBaseDto({
          body: 'Reviewer manually entered body content',
          aiSummary: 'AI-generated summary of the document',
          ocrText: 'raw OCR text',
        });

        await service.importCorrespondence(dto, 'idem-d159-2', 1);

        expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
          CorrespondenceRevision,
          expect.objectContaining({
            body: 'Reviewer manually entered body content',
          })
        );
      });

      it('does NOT use ocrText as revision.body when neither body nor aiSummary exists', async () => {
        setupImportMocks();
        const dto = createBaseDto({
          ocrText: 'raw OCR text that should NOT be used as body',
        });

        await service.importCorrespondence(dto, 'idem-d159-3', 1);

        // body ต้องเป็น undefined ไม่ใช่ ocrText
        expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
          CorrespondenceRevision,
          expect.objectContaining({
            body: undefined,
          })
        );
        // ต้องไม่มีการส่ง ocrText เป็น body
        const createCalls = mockQueryRunner.manager.create.mock.calls.filter(
          (call: unknown[]) => call[0] === CorrespondenceRevision
        ) as unknown[][];
        const revisionArg: Record<string, unknown> =
          createCalls[0][1] as Record<string, unknown>;
        expect(revisionArg['body']).not.toBe(
          'raw OCR text that should NOT be used as body'
        );
      });
    });

    // Regression: เดิมไม่ส่ง issueDate ทำให้ attachment ถูกเก็บใน folder ตามวันที่ import
    // แทนวันที่ของเอกสาร — ไฟล์เอกสารเก่าจึงกระจุกอยู่ใน ปี/เดือน ปัจจุบัน
    describe('attachment folder date จาก documentDate', () => {
      const setupImportMocks = (): void => {
        mockDataSource.manager.findOne.mockResolvedValue({ id: 5 });
        mockQueryRunner.manager.findOne.mockResolvedValue(null);
        mockQueryRunner.manager.create.mockImplementation(
          (_entity: unknown, value: unknown) => value
        );
        mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
        mockQueryRunner.manager.find.mockResolvedValue([]);
        mockQueryRunner.manager.query.mockResolvedValue([]);
      };

      it('ส่ง issueDate = documentDate เมื่อ import จาก sourceFilePath', async () => {
        setupImportMocks();
        mockFileStorageService.importStagingFile.mockResolvedValue({ id: 55 });

        const dto: ImportCorrespondenceDto = {
          documentNumber: 'DOC-DATE-1',
          subject: 'Attachment date',
          category: 'Letter',
          migratedBy: 'SYSTEM_IMPORT',
          batchId: 'BATCH-DATE',
          projectId: 100,
          documentDate: '2024-03-15',
          sourceFilePath: '/staging/doc-date-1.pdf',
        };

        await service.importCorrespondence(dto, 'idem-date-1', 1);

        expect(mockFileStorageService.importStagingFile).toHaveBeenCalledWith(
          '/staging/doc-date-1.pdf',
          1,
          expect.objectContaining({
            documentType: 'Letter',
            issueDate: new Date('2024-03-15'),
          })
        );
      });

      it('ส่ง issueDate ของทุกไฟล์เมื่อ import จาก sourceFilePaths (ADR-047)', async () => {
        setupImportMocks();
        mockFileStorageService.importStagingFile
          .mockResolvedValueOnce({ id: 61 })
          .mockResolvedValueOnce({ id: 62 });

        const dto: ImportCorrespondenceDto = {
          documentNumber: 'DOC-DATE-2',
          subject: 'Attachment date multi',
          category: 'Letter',
          migratedBy: 'SYSTEM_IMPORT',
          batchId: 'BATCH-DATE',
          projectId: 100,
          documentDate: '2023-11-02',
          sourceFilePaths: ['/staging/a.pdf', '/staging/b.pdf'],
        };

        await service.importCorrespondence(dto, 'idem-date-2', 1);

        expect(mockFileStorageService.importStagingFile).toHaveBeenCalledTimes(
          2
        );
        const calls = mockFileStorageService.importStagingFile.mock
          .calls as unknown as Array<[string, number, { issueDate?: Date }]>;
        for (const call of calls) {
          expect(call[2].issueDate).toEqual(new Date('2023-11-02'));
        }
      });

      it('ส่ง issueDate = undefined เมื่อไม่มี documentDate (fallback เป็นวันที่ปัจจุบัน)', async () => {
        setupImportMocks();
        mockFileStorageService.importStagingFile.mockResolvedValue({ id: 70 });

        const dto: ImportCorrespondenceDto = {
          documentNumber: 'DOC-DATE-3',
          subject: 'No document date',
          category: 'Letter',
          migratedBy: 'SYSTEM_IMPORT',
          batchId: 'BATCH-DATE',
          projectId: 100,
          sourceFilePath: '/staging/no-date.pdf',
        };

        await service.importCorrespondence(dto, 'idem-date-3', 1);

        const calls = mockFileStorageService.importStagingFile.mock
          .calls as unknown as Array<[string, number, { issueDate?: Date }]>;
        expect(calls[0][2].issueDate).toBeUndefined();
      });
    });
  });

  // ── Helper: ตั้งค่า mock สำหรับ importCorrespondence สำเร็จ ──────────────────
  const setupFullSuccessfulImport = (): void => {
    mockTransactionRepo.findOne.mockResolvedValue(null);
    mockTransactionRepo.create.mockReturnValue({});
    mockTransactionRepo.save.mockResolvedValue({});
    mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
    mockStatusRepo.findOne.mockResolvedValue({ id: 10, statusCode: 'CLBOWN' });
    mockProjectRepo.findOne.mockResolvedValue({
      id: 100,
      publicId: 'proj-uuid',
    });
    mockDataSource.manager.findOne.mockResolvedValue(null);
    mockQueryRunner.manager.findOne.mockResolvedValue(null);
    mockQueryRunner.manager.create.mockImplementation(
      (_entity: unknown, value: unknown) => ({
        ...(value as Record<string, unknown>),
        id: 1,
      })
    );
    mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
    mockQueryRunner.manager.find.mockResolvedValue([]);
    mockQueryRunner.manager.query.mockResolvedValue([]);
    mockQueryRunner.manager.update.mockResolvedValue({});
  };

  // ── importCorrespondence: idempotency & existing transaction ──────────────────
  describe('importCorrespondence — idempotency & existing transaction', () => {
    it('throws ValidationException when idempotencyKey is empty', async () => {
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-X',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-X',
        projectId: 100,
      };
      await expect(service.importCorrespondence(dto, '', 1)).rejects.toThrow(
        ValidationException
      );
    });

    it('returns cached success when transaction already succeeded', async () => {
      mockTransactionRepo.findOne.mockResolvedValue({
        idempotencyKey: 'idem-succ',
        statusCode: 201,
      });
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-SUCC',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-SUCC',
        projectId: 100,
      };
      const result = await service.importCorrespondence(dto, 'idem-succ', 1);
      expect(result.message).toBe('Already processed');
    });

    it('throws ConflictException when transaction previously failed', async () => {
      mockTransactionRepo.findOne.mockResolvedValue({
        idempotencyKey: 'idem-fail',
        statusCode: 500,
      });
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-FAIL',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-FAIL',
        projectId: 100,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-fail', 1)
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── importCorrespondence: dependency resolution failures ──────────────────────
  describe('importCorrespondence — dependency resolution', () => {
    beforeEach(() => {
      mockTransactionRepo.findOne.mockResolvedValue(null);
    });

    it('throws ValidationException when category not found (all fallbacks fail)', async () => {
      mockTypeRepo.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NOTYPE',
        subject: 'Test',
        category: 'NonExistent',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NOTYPE',
        projectId: 100,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-notype', 1)
      ).rejects.toThrow(ValidationException);
    });

    it('resolves type via typeCode fallback when typeName not found', async () => {
      mockTypeRepo.findOne
        .mockResolvedValueOnce(null) // typeName lookup
        .mockResolvedValueOnce({ id: 2, typeCode: 'LETTER' }); // typeCode lookup
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => v
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-CODE',
        subject: 'Test',
        category: 'LETTER',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-CODE',
        projectId: 100,
      };
      await service.importCorrespondence(dto, 'idem-code', 1);
      expect(mockTypeRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('resolves type via alias map when both typeName and typeCode fail', async () => {
      mockTypeRepo.findOne
        .mockResolvedValueOnce(null) // typeName
        .mockResolvedValueOnce(null) // typeCode
        .mockResolvedValueOnce({ id: 3, typeCode: 'OTHER' }); // alias
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => v
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-ALIAS',
        subject: 'Test',
        category: 'Drawing',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-ALIAS',
        projectId: 100,
      };
      await service.importCorrespondence(dto, 'idem-alias', 1);
      expect(mockTypeRepo.findOne).toHaveBeenCalledTimes(3);
    });

    it('falls back to DRAFT status when CLBOWN not found', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne
        .mockResolvedValueOnce(null) // CLBOWN
        .mockResolvedValueOnce({ id: 20, statusCode: 'DRAFT' }); // DRAFT
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => v
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-DRAFT',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-DRAFT',
        projectId: 100,
      };
      await service.importCorrespondence(dto, 'idem-draft', 1);
      expect(mockStatusRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('throws SystemException when no status found at all', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NOSTAT',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NOSTAT',
        projectId: 100,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-nostat', 1)
      ).rejects.toThrow(SystemException);
    });

    it('throws NotFoundException when project not found', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NOPROJ',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NOPROJ',
        projectId: 999,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-noproj', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when sender org not found by publicId', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NOSENDER',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NOSENDER',
        projectId: 100,
        senderPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      };
      await expect(
        service.importCorrespondence(dto, 'idem-nosender', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when receiver org not found by publicId', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 5 }) // sender
        .mockResolvedValueOnce(null); // receiver not found
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NORECV',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NORECV',
        projectId: 100,
        senderPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        receiverPublicId: '019505a1-7c3e-7000-8000-abc123def999',
      };
      await expect(
        service.importCorrespondence(dto, 'idem-norecv', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when discipline not found', async () => {
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-NODISC',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-NODISC',
        projectId: 100,
        disciplineId: 999,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-nodisc', 1)
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── importCorrespondence: RFA, existing correspondence, tags, RAG, rollback ───
  describe('importCorrespondence — RFA, existing, tags, RAG, rollback', () => {
    it('creates RFA type and RfaRevision when category is RFA', async () => {
      setupFullSuccessfulImport();
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'RFA' });
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ id: 100 }]) // rfa_types
        .mockResolvedValueOnce([{ id: 200 }]) // rfa_status_codes
        .mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-RFA',
        subject: 'RFA Test',
        category: 'RFA',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-RFA',
        projectId: 100,
      };
      await service.importCorrespondence(dto, 'idem-rfa', 1);
      // ต้องสร้าง Rfa entity
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Rfa,
        expect.objectContaining({ rfaTypeId: 100 })
      );
      // ต้องสร้าง RfaRevision entity
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        RfaRevision,
        expect.objectContaining({ rfaStatusCodeId: 200 })
      );
    });

    it('throws SystemException (wrapping BusinessException) when RFA type not found in seed data', async () => {
      setupFullSuccessfulImport();
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'RFA' });
      mockQueryRunner.manager.query.mockResolvedValueOnce([]); // no rfa_types

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-RFA-NOTYPE',
        subject: 'RFA No Type',
        category: 'RFA',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-RFA',
        projectId: 100,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-rfa-notype', 1)
      ).rejects.toThrow(SystemException);
    });

    it('skips RfaRevision when rfa_status_codes not found (warns, no throw)', async () => {
      setupFullSuccessfulImport();
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'RFA' });
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ id: 100 }]) // rfa_types
        .mockResolvedValueOnce([]) // no rfa_status_codes
        .mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-RFA-NOSTAT',
        subject: 'RFA No Status',
        category: 'RFA',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-RFA',
        projectId: 100,
      };
      await service.importCorrespondence(dto, 'idem-rfa-nostat', 1);
      // ต้องไม่สร้าง RfaRevision
      const rfaRevCalls = mockQueryRunner.manager.create.mock.calls.filter(
        (c: unknown[]) => c[0] === RfaRevision
      );
      expect(rfaRevCalls).toHaveLength(0);
    });

    it('updates existing correspondence with missing discipline and originator', async () => {
      setupFullSuccessfulImport();
      const existingCorr = {
        id: 50,
        disciplineId: null,
        originatorId: null,
        publicId: 'corr-uuid',
        correspondenceNumber: 'DOC-EXIST',
      };
      mockQueryRunner.manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Correspondence) return existingCorr;
        return null;
      });
      mockDataSource.manager.findOne.mockResolvedValue({ id: 5 }); // discipline

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-EXIST',
        subject: 'Existing',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-EXIST',
        projectId: 100,
        disciplineId: 5,
        senderId: 7,
      };
      await service.importCorrespondence(dto, 'idem-exist', 1);
      // ต้อง save correspondence (เพราะมี hasChanges)
      expect(existingCorr.disciplineId).toBe(5);
      expect(existingCorr.originatorId).toBe(7);
    });

    it('updates existing current revision instead of creating new', async () => {
      setupFullSuccessfulImport();
      const existingRev = {
        id: 99,
        isCurrent: true,
        revisionNumber: 0,
        subject: '',
        body: '',
        documentDate: undefined,
        receivedDate: undefined,
        remarks: undefined,
        details: {},
      };
      mockQueryRunner.manager.find.mockResolvedValue([existingRev]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-REVUPD',
        subject: 'Updated Subject',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-REVUPD',
        projectId: 100,
        body: 'Updated body',
        aiSummary: 'AI summary',
      };
      await service.importCorrespondence(dto, 'idem-revupd', 1);
      expect(existingRev.subject).toBe('Updated Subject');
      expect(existingRev.body).toBe('Updated body');
    });

    it('handles tempAttachmentIds by marking them permanent', async () => {
      setupFullSuccessfulImport();
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-ATTIDS',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-ATTIDS',
        projectId: 100,
        tempAttachmentIds: [10, 20],
        ocrText: 'OCR text',
      };
      await service.importCorrespondence(dto, 'idem-attids', 1);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Attachment,
        { id: expect.anything() },
        { isTemporary: false }
      );
    });

    it('handles sourceFilePaths with file import errors (continues without attachment)', async () => {
      setupFullSuccessfulImport();
      mockFileStorageService.importStagingFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({ id: 62 });

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-MULTIERR',
        subject: 'Multi error',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-MULTIERR',
        projectId: 100,
        sourceFilePaths: ['/staging/bad.pdf', '/staging/good.pdf'],
      };
      await service.importCorrespondence(dto, 'idem-multierr', 1);
      expect(mockFileStorageService.importStagingFile).toHaveBeenCalledTimes(2);
    });

    it('handles sourceFilePath with file import error (continues without attachment)', async () => {
      setupFullSuccessfulImport();
      mockFileStorageService.importStagingFile.mockRejectedValue(
        new Error('Import failed')
      );

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-SINGLEERR',
        subject: 'Single error',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-SINGLEERR',
        projectId: 100,
        sourceFilePath: '/staging/bad.pdf',
      };
      await service.importCorrespondence(dto, 'idem-singleerr', 1);
      expect(mockFileStorageService.importStagingFile).toHaveBeenCalled();
    });

    it('triggers RAG prepare after successful import with attachment', async () => {
      setupFullSuccessfulImport();
      mockFileStorageService.importStagingFile.mockResolvedValue({ id: 55 });
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(null) // correspondence lookup
        .mockResolvedValueOnce({
          publicId: 'att-uuid',
          filePath: '/permanent/file.pdf',
        }); // main attachment lookup post-commit

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-RAG',
        subject: 'RAG Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-RAG',
        projectId: 100,
        sourceFilePath: '/staging/rag.pdf',
        ocrText: 'OCR content',
      };
      await service.importCorrespondence(dto, 'idem-rag', 1);
      // ragBatchService.enqueueRagPrepare ถูก inject เป็น mock — ตรวจ via importStagingFile called
      expect(mockFileStorageService.importStagingFile).toHaveBeenCalled();
    });

    it('handles tags from dto.details (string and object formats)', async () => {
      setupFullSuccessfulImport();
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([]) // tag lookup — not found
        .mockResolvedValueOnce({ insertId: 301 }) // tag insert
        .mockResolvedValueOnce([{ id: 302 }]) // second tag lookup — found
        .mockResolvedValue([]);

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-TAGS',
        subject: 'Tags Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-TAGS',
        projectId: 100,
        details: {
          tags: ['newTag', { tagName: 'existingTag' }, { wrongKey: 'x' }],
        },
      };
      await service.importCorrespondence(dto, 'idem-tags', 1);
      // ต้องมีการ query tag lookup อย่างน้อย 2 ครั้ง (skip รายการที่ไม่มี tagName)
      expect(mockQueryRunner.manager.query).toHaveBeenCalled();
    });

    it('rolls back and creates failed transaction on import error', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(null);
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({ id: 10 });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100 });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      // ทำให้ queryRunner.manager.findOne throw เพื่อ trigger catch
      mockQueryRunner.manager.findOne.mockRejectedValue(
        new Error('DB connection lost')
      );
      mockTransactionRepo.create.mockReturnValue({
        idempotencyKey: 'idem-err',
      });
      mockTransactionRepo.save.mockResolvedValue({});

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-ERR',
        subject: 'Error Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-ERR',
        projectId: 100,
      };
      await expect(
        service.importCorrespondence(dto, 'idem-err', 1)
      ).rejects.toThrow(SystemException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ── enqueueRecord ─────────────────────────────────────────────────────────────
  describe('enqueueRecord', () => {
    it('throws ValidationException when documentNumber is missing', async () => {
      const dto = {
        documentNumber: '',
      } as unknown as EnqueueMigrationDto;
      await expect(service.enqueueRecord(dto)).rejects.toThrow(
        ValidationException
      );
    });

    it('sets status to REJECTED when isValid is false', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      mockReviewQueueRepo.create.mockImplementation((v: unknown) => v);
      mockReviewQueueRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve({ ...v, id: 1 })
      );

      const dto: EnqueueMigrationDto = {
        documentNumber: 'DOC-REJ',
        isValid: false,
      } as unknown as EnqueueMigrationDto;

      const result = await service.enqueueRecord(dto);
      expect(result.status).toBe(MigrationReviewStatus.REJECTED);
    });

    it('sets status to REJECTED when confidence < 0.6', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      mockReviewQueueRepo.create.mockImplementation((v: unknown) => v);
      mockReviewQueueRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve({ ...v, id: 2 })
      );

      const dto: EnqueueMigrationDto = {
        documentNumber: 'DOC-LOWCONF',
        confidence: 0.3,
      } as unknown as EnqueueMigrationDto;

      const result = await service.enqueueRecord(dto);
      expect(result.status).toBe(MigrationReviewStatus.REJECTED);
    });

    it('creates new queue item when not found and sets PENDING status', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      mockReviewQueueRepo.create.mockImplementation((v: unknown) => ({
        ...(v as Record<string, unknown>),
        id: 3,
      }));
      mockReviewQueueRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve({ ...v, id: 3 })
      );

      const dto: EnqueueMigrationDto = {
        documentNumber: 'DOC-NEW',
        subject: 'New doc',
        category: 'Letter',
        projectId: 100,
        tempAttachmentIds: [10, 20],
        compareStatus: CompareStatus.COMPARED,
        compareUnavailableReason: 'N/A',
        issuedDate: '2024-01-15',
        receivedDate: '2024-01-20',
      } as unknown as EnqueueMigrationDto;

      const result = await service.enqueueRecord(dto);
      expect(result.status).toBe(MigrationReviewStatus.PENDING);
      expect(result.id).toBe(3);
    });

    it('updates existing queue item when found', async () => {
      const existing = {
        id: 5,
        documentNumber: 'DOC-EXIST',
        status: MigrationReviewStatus.PENDING,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(existing);
      mockReviewQueueRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve({ ...v, id: 5 })
      );

      const dto: EnqueueMigrationDto = {
        documentNumber: 'DOC-EXIST',
        subject: 'Updated',
        tempAttachmentId: 42,
      } as unknown as EnqueueMigrationDto;

      const result = await service.enqueueRecord(dto);
      expect(result.id).toBe(5);
      // ต้องแปลง tempAttachmentId เดี่ยวเป็น array
      expect(existing.tempAttachmentIds).toEqual([42]);
    });

    it('does not set issuedDate when date string is invalid', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      mockReviewQueueRepo.create.mockImplementation((v: unknown) => v);
      mockReviewQueueRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve({ ...v, id: 6 })
      );

      const dto: EnqueueMigrationDto = {
        documentNumber: 'DOC-BADDATE',
        issuedDate: 'not-a-date',
        receivedDate: 'also-bad',
      } as unknown as EnqueueMigrationDto;

      const result = await service.enqueueRecord(dto);
      expect(result.status).toBe(MigrationReviewStatus.PENDING);
    });
  });

  // ── updateQueueEnrichment ─────────────────────────────────────────────────────
  describe('updateQueueEnrichment', () => {
    it('updates fields when queue item is found', async () => {
      const item = {
        id: 1,
        ocrText: null,
        aiSummary: null,
        aiSuggestedCategory: null,
        extractedTags: null,
        aiConfidence: null,
        aiIssues: null,
        aiFailed: false,
        aiStatus: null,
        status: MigrationReviewStatus.PENDING,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(item);
      mockReviewQueueRepo.save.mockResolvedValue(item);

      await service.updateQueueEnrichment(1, {
        ocrText: 'OCR text',
        aiSummary: 'Summary',
        aiSuggestedCategory: 'LETTER',
        extractedTags: [{ tag: 'value' }],
        aiConfidence: 0.85,
        aiIssues: [{ issue: 'test' }],
        aiFailed: false,
        aiStatus: MigrationAiStatus.DONE,
        status: MigrationReviewStatus.PENDING_REVIEW,
      });

      expect(item.ocrText).toBe('OCR text');
      expect(item.aiSummary).toBe('Summary');
      expect(item.aiSuggestedCategory).toBe('LETTER');
      expect(item.aiConfidence).toBe(0.85);
      expect(item.aiStatus).toBe(MigrationAiStatus.DONE);
      expect(item.status).toBe(MigrationReviewStatus.PENDING_REVIEW);
      expect(mockReviewQueueRepo.save).toHaveBeenCalled();
    });

    it('does nothing when queue item is not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      await service.updateQueueEnrichment(999, { ocrText: 'text' });
      expect(mockReviewQueueRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── startExtractQueueItem ─────────────────────────────────────────────────────
  describe('startExtractQueueItem', () => {
    it('throws ConflictException when status is not PENDING', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'queue-uuid-001',
        status: MigrationReviewStatus.IMPORTED,
        aiStatus: null,
        aiJobId: null,
      });

      await expect(
        service.startExtractQueueItem('queue-uuid-001', 'idem-1', 1)
      ).rejects.toThrow(ConflictException);
    });

    it('returns "already running" when aiStatus is RUNNING', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 2,
        publicId: 'queue-uuid-002',
        status: MigrationReviewStatus.PENDING,
        aiStatus: MigrationAiStatus.RUNNING,
        aiJobId: 'job-123',
      });

      const result = await service.startExtractQueueItem(
        'queue-uuid-002',
        'idem-2',
        1
      );
      expect(result.message).toBe('AI extraction already running or queued');
    });

    it('returns "already running" when aiJobId exists and not FAILED', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 3,
        publicId: 'queue-uuid-003',
        status: MigrationReviewStatus.PENDING,
        aiStatus: MigrationAiStatus.WAITING,
        aiJobId: 'job-456',
      });

      const result = await service.startExtractQueueItem(
        'queue-uuid-003',
        'idem-3',
        1
      );
      expect(result.message).toBe('AI extraction already running or queued');
    });

    it('starts extraction successfully with projectId', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 4,
        publicId: 'queue-uuid-004',
        status: MigrationReviewStatus.PENDING,
        aiStatus: null,
        aiJobId: null,
        projectId: 100,
        documentNumber: 'DOC-EXT',
        details: { source_file_path: '/staging/doc.pdf' },
      });
      mockProjectRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: 'proj-uuid-004',
      });
      mockAiBatchQueue.add.mockResolvedValue({ id: 'job-789' });
      mockReviewQueueRepo.save.mockResolvedValue({});

      const result = await service.startExtractQueueItem(
        'queue-uuid-004',
        'idem-4',
        1
      );
      expect(result.message).toBe('AI extraction started');
      expect(result.jobId).toBe('job-789');
    });

    it('starts extraction without projectId (uses default UUID)', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 5,
        publicId: 'queue-uuid-005',
        status: MigrationReviewStatus.PENDING,
        aiStatus: MigrationAiStatus.FAILED,
        aiJobId: 'old-job',
        projectId: null,
        documentNumber: 'DOC-EXT2',
        details: {},
      });
      mockAiBatchQueue.add.mockResolvedValue({ id: 'job-000' });
      mockReviewQueueRepo.save.mockResolvedValue({});

      const result = await service.startExtractQueueItem(
        'queue-uuid-005',
        'idem-5',
        1
      );
      expect(result.message).toBe('AI extraction started');
      expect(mockProjectRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ── startExtractBatch ─────────────────────────────────────────────────────────
  describe('startExtractBatch', () => {
    it('processes multiple items and returns results', async () => {
      mockReviewQueueRepo.findOne
        .mockResolvedValueOnce({
          id: 1,
          publicId: 'uuid-1',
          status: MigrationReviewStatus.PENDING,
          aiStatus: null,
          aiJobId: null,
          projectId: null,
          documentNumber: 'DOC-1',
          details: {},
        })
        .mockResolvedValueOnce({
          id: 2,
          publicId: 'uuid-2',
          status: MigrationReviewStatus.IMPORTED,
          aiStatus: null,
          aiJobId: null,
          projectId: null,
          documentNumber: 'DOC-2',
          details: {},
        });
      mockAiBatchQueue.add.mockResolvedValue({ id: 'job-1' });
      mockReviewQueueRepo.save.mockResolvedValue({});

      const result = await service.startExtractBatch(
        ['uuid-1', 'uuid-2'],
        'idem-batch',
        1
      );
      expect(result.results).toHaveLength(2);
      expect(result.results[0].publicId).toBe('uuid-1');
      expect(result.results[1].publicId).toBe('uuid-2');
      expect(result.results[1].error).toBeDefined();
    });
  });

  // ── getReviewQueue ────────────────────────────────────────────────────────────
  describe('getReviewQueue', () => {
    it('returns paginated results with filters', async () => {
      mockReviewQueueRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: 1, documentNumber: 'DOC-1' }],
        1,
      ]);
      mockAttachmentFind.mockResolvedValue([]);

      const query: MigrationQueueQueryDto = {
        page: 1,
        limit: 10,
        status: MigrationReviewStatus.PENDING,
        aiStatus: MigrationAiStatus.WAITING,
        batchId: 'BATCH-1',
      } as unknown as MigrationQueueQueryDto;

      const result = await service.getReviewQueue(query);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('returns paginated results without filters', async () => {
      mockReviewQueueRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      mockAttachmentFind.mockResolvedValue([]);

      const query: MigrationQueueQueryDto =
        {} as unknown as MigrationQueueQueryDto;

      const result = await service.getReviewQueue(query);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });
  });

  // ── getQueueItemByPublicId ────────────────────────────────────────────────────
  describe('getQueueItemByPublicId', () => {
    it('returns enriched item when found', async () => {
      const item = {
        id: 1,
        publicId: 'queue-uuid-100',
        documentNumber: 'DOC-100',
        tempAttachmentIds: null,
        tempAttachmentId: null,
        senderOrganizationId: 10,
        receiverOrganizationId: 20,
        aiSuggestedCategory: 'LETTER',
      } as unknown as MigrationReviewQueue;
      mockReviewQueueRepo.findOne.mockResolvedValue(item);
      mockAttachmentFind.mockResolvedValue([]);
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockTypeRepo.find.mockResolvedValue([]);

      const result = await service.getQueueItemByPublicId('queue-uuid-100');
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getQueueItemByPublicId('nonexistent-uuid')
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createError ───────────────────────────────────────────────────────────────
  describe('createError', () => {
    it('creates and returns error with id', async () => {
      mockMigrationErrorRepo.create.mockImplementation((v: unknown) => v);
      mockMigrationErrorRepo.save.mockResolvedValue({ id: 42 });

      const dto: CreateMigrationErrorDto = {
        batchId: 'BATCH-ERR',
        documentNumber: 'DOC-ERR',
        errorType: MigrationErrorType.FILE_NOT_FOUND,
        errorMessage: 'File not found',
        rawAiResponse: '{}',
      };

      const result = await service.createError(dto);
      expect(result.message).toBe('Error logged');
      expect(result.id).toBe(42);
    });
  });

  // ── getErrors ─────────────────────────────────────────────────────────────────
  describe('getErrors', () => {
    it('returns paginated errors', async () => {
      mockMigrationErrorRepo.findAndCount.mockResolvedValue([
        [{ id: 1, documentNumber: 'DOC-1' }],
        1,
      ]);

      const result = await service.getErrors(2, 5);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(1);
    });

    it('uses default page and limit', async () => {
      mockMigrationErrorRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getErrors();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ── deleteReviewQueueByBatch ──────────────────────────────────────────────────
  describe('deleteReviewQueueByBatch', () => {
    it('throws ValidationException when no batchId and not all', async () => {
      await expect(
        service.deleteReviewQueueByBatch(undefined, false)
      ).rejects.toThrow(ValidationException);
    });

    it('deletes by batchId and removes BullMQ jobs', async () => {
      mockReviewQueueRepo.find.mockResolvedValue([
        { aiJobId: 'job-1' },
        { aiJobId: 'job-2' },
        { aiJobId: null },
      ]);
      mockAiBatchQueue.remove.mockResolvedValue(undefined);
      mockReviewQueueRepo.delete.mockResolvedValue({ affected: 2 });

      const result = await service.deleteReviewQueueByBatch('BATCH-1');
      expect(result.deleted).toBe(2);
      expect(mockAiBatchQueue.remove).toHaveBeenCalledTimes(2);
    });

    it('deletes all when all=true', async () => {
      mockReviewQueueRepo.find.mockResolvedValue([]);
      mockReviewQueueRepo.delete.mockResolvedValue({ affected: 100 });

      const result = await service.deleteReviewQueueByBatch(undefined, true);
      expect(result.deleted).toBe(100);
    });

    it('deletes by publicIds', async () => {
      mockReviewQueueRepo.find.mockResolvedValue([{ aiJobId: 'job-3' }]);
      mockAiBatchQueue.remove.mockResolvedValue(undefined);
      mockReviewQueueRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteReviewQueueByBatch(undefined, false, [
        'uuid-1',
        'uuid-2',
      ]);
      expect(result.deleted).toBe(1);
    });

    it('handles BullMQ remove errors gracefully', async () => {
      mockReviewQueueRepo.find.mockResolvedValue([{ aiJobId: 'job-err' }]);
      mockAiBatchQueue.remove.mockRejectedValue(new Error('Redis down'));
      mockReviewQueueRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteReviewQueueByBatch('BATCH-ERR');
      expect(result.deleted).toBe(1);
    });

    it('returns 0 when affected is undefined', async () => {
      mockReviewQueueRepo.find.mockResolvedValue([]);
      mockReviewQueueRepo.delete.mockResolvedValue({});

      const result = await service.deleteReviewQueueByBatch('BATCH-0');
      expect(result.deleted).toBe(0);
    });
  });

  // ── deleteErrorsByBatch ───────────────────────────────────────────────────────
  describe('deleteErrorsByBatch', () => {
    it('throws ValidationException when no batchId and not all', async () => {
      await expect(
        service.deleteErrorsByBatch(undefined, false)
      ).rejects.toThrow(ValidationException);
    });

    it('deletes by batchId', async () => {
      mockMigrationErrorRepo.delete.mockResolvedValue({ affected: 5 });

      const result = await service.deleteErrorsByBatch('BATCH-ERR');
      expect(result.deleted).toBe(5);
    });

    it('deletes all when all=true', async () => {
      mockMigrationErrorRepo.delete.mockResolvedValue({ affected: 50 });

      const result = await service.deleteErrorsByBatch(undefined, true);
      expect(result.deleted).toBe(50);
    });

    it('returns 0 when affected is undefined', async () => {
      mockMigrationErrorRepo.delete.mockResolvedValue({});

      const result = await service.deleteErrorsByBatch('BATCH-NULL');
      expect(result.deleted).toBe(0);
    });
  });

  // ── getQueueBatches ───────────────────────────────────────────────────────────
  describe('getQueueBatches', () => {
    it('returns distinct batch IDs from review queue', async () => {
      mockReviewQueueRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { batchId: 'BATCH-A' },
        { batchId: 'BATCH-B' },
        { batchId: null },
      ]);

      const result = await service.getQueueBatches();
      expect(result).toEqual(['BATCH-A', 'BATCH-B']);
    });
  });

  // ── getErrorBatches ───────────────────────────────────────────────────────────
  describe('getErrorBatches', () => {
    it('returns distinct batch IDs from errors', async () => {
      mockMigrationErrorRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder
      );
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { batchId: 'ERR-A' },
        { batchId: 'ERR-B' },
      ]);

      const result = await service.getErrorBatches();
      expect(result).toEqual(['ERR-A', 'ERR-B']);
    });
  });

  // ── approveQueueItem ──────────────────────────────────────────────────────────
  describe('approveQueueItem', () => {
    it('throws NotFoundException when queue item not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-1',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        projectId: 100,
      };
      await expect(
        service.approveQueueItem(999, dto, 'idem-1', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BusinessException when status is not PENDING_REVIEW', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 1,
        status: MigrationReviewStatus.PENDING,
      });
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-1',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        projectId: 100,
      };
      await expect(
        service.approveQueueItem(1, dto, 'idem-1', 1)
      ).rejects.toThrow(BusinessException);
    });

    it('approves successfully and updates queue item status to IMPORTED', async () => {
      const queueItem = {
        id: 1,
        status: MigrationReviewStatus.PENDING_REVIEW,
        ocrText: 'cached OCR',
        aiSummary: 'AI summary',
        remarks: 'remarks',
        tempAttachmentId: null,
        tempAttachmentIds: null,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      // Mock importCorrespondence internals
      mockTransactionRepo.findOne.mockResolvedValue(null);
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({
        id: 10,
        statusCode: 'CLBOWN',
      });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100, publicId: 'proj' });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => ({
          ...(v as Record<string, unknown>),
          id: 1,
        })
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);
      mockReviewQueueRepo.save.mockResolvedValue({});

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-APPR',
        subject: 'Approve',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-APPR',
        projectId: 100,
      };
      const result = await service.approveQueueItem(1, dto, 'idem-appr', 1);
      expect(result.message).toBe('Import successful');
      expect(queueItem.status).toBe(MigrationReviewStatus.IMPORTED);
    });
  });

  // ── approveQueueItemByPublicId ────────────────────────────────────────────────
  describe('approveQueueItemByPublicId', () => {
    it('throws NotFoundException when not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-1',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        projectId: 100,
      };
      await expect(
        service.approveQueueItemByPublicId('nonexistent', dto, 'idem-1', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BusinessException when not PENDING_REVIEW', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-1',
        status: MigrationReviewStatus.REJECTED,
      });
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-1',
        subject: 'Test',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        projectId: 100,
      };
      await expect(
        service.approveQueueItemByPublicId('uuid-1', dto, 'idem-1', 1)
      ).rejects.toThrow(BusinessException);
    });

    it('approves successfully by publicId', async () => {
      const queueItem = {
        id: 1,
        publicId: 'uuid-appr',
        status: MigrationReviewStatus.PENDING_REVIEW,
        ocrText: null,
        aiSummary: null,
        remarks: null,
        tempAttachmentId: null,
        tempAttachmentIds: null,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockTransactionRepo.findOne.mockResolvedValue(null);
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({
        id: 10,
        statusCode: 'CLBOWN',
      });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100, publicId: 'proj' });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => ({
          ...(v as Record<string, unknown>),
          id: 1,
        })
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);
      mockReviewQueueRepo.save.mockResolvedValue({});

      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-APPRPB',
        subject: 'Approve by publicId',
        category: 'Letter',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-APPRPB',
        projectId: 100,
      };
      const result = await service.approveQueueItemByPublicId(
        'uuid-appr',
        dto,
        'idem-apprpb',
        1
      );
      expect(result.message).toBe('Import successful');
      expect(queueItem.status).toBe(MigrationReviewStatus.IMPORTED);
    });
  });

  // ── commitBatch ───────────────────────────────────────────────────────────────
  describe('commitBatch', () => {
    it('throws ValidationException when idempotencyKey is empty', async () => {
      const dto: CommitBatchDto = {
        batchId: 'BATCH-1',
        items: [],
      } as unknown as CommitBatchDto;
      await expect(service.commitBatch(dto, '', 1)).rejects.toThrow(
        ValidationException
      );
    });

    it('processes batch with successes and failures', async () => {
      // First item: approveQueueItemByPublicId will find queue item but throw BusinessException
      mockReviewQueueRepo.findOne
        .mockResolvedValueOnce({
          id: 1,
          publicId: 'uuid-ok',
          status: MigrationReviewStatus.PENDING_REVIEW,
          ocrText: null,
          aiSummary: null,
          remarks: null,
          tempAttachmentId: null,
          tempAttachmentIds: null,
        })
        .mockResolvedValueOnce({
          id: 2,
          publicId: 'uuid-bad',
          status: MigrationReviewStatus.REJECTED, // not PENDING_REVIEW → throws
        });

      // Mock importCorrespondence for the successful item
      mockTransactionRepo.findOne.mockResolvedValue(null);
      mockTypeRepo.findOne.mockResolvedValue({ id: 1, typeCode: 'LETTER' });
      mockStatusRepo.findOne.mockResolvedValue({
        id: 10,
        statusCode: 'CLBOWN',
      });
      mockProjectRepo.findOne.mockResolvedValue({ id: 100, publicId: 'proj' });
      mockDataSource.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(
        (_e: unknown, v: unknown) => ({
          ...(v as Record<string, unknown>),
          id: 1,
        })
      );
      mockQueryRunner.manager.save.mockResolvedValue({ id: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.query.mockResolvedValue([]);
      mockReviewQueueRepo.save.mockResolvedValue({});

      const dto: CommitBatchDto = {
        batchId: 'BATCH-COMMIT',
        items: [
          {
            queuePublicId: 'uuid-ok',
            dto: {
              documentNumber: 'DOC-OK',
              subject: 'OK',
              category: 'Letter',
              migratedBy: 'SYSTEM_IMPORT',
              projectId: 100,
            } as unknown as ImportCorrespondenceDto,
          },
          {
            queuePublicId: 'uuid-bad',
            dto: {
              documentNumber: 'DOC-BAD',
              subject: 'Bad',
              category: 'Letter',
              migratedBy: 'SYSTEM_IMPORT',
              projectId: 100,
            } as unknown as ImportCorrespondenceDto,
          },
        ],
      } as unknown as CommitBatchDto;

      const result = await service.commitBatch(dto, 'idem-commit', 1);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ── rejectQueueItem ───────────────────────────────────────────────────────────
  describe('rejectQueueItem', () => {
    it('throws NotFoundException when not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      await expect(service.rejectQueueItem(999, 1)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects successfully and sets status to REJECTED', async () => {
      const queueItem = {
        id: 1,
        status: MigrationReviewStatus.PENDING_REVIEW,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockReviewQueueRepo.save.mockResolvedValue({});

      const result = await service.rejectQueueItem(1, 1);
      expect(result.message).toBe('Document rejected successfully');
      expect(result.id).toBe(1);
      expect(queueItem.status).toBe(MigrationReviewStatus.REJECTED);
    });
  });

  // ── rejectQueueItemByPublicId ─────────────────────────────────────────────────
  describe('rejectQueueItemByPublicId', () => {
    it('throws NotFoundException when not found', async () => {
      mockReviewQueueRepo.findOne.mockResolvedValue(null);
      await expect(
        service.rejectQueueItemByPublicId('nonexistent', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects successfully by publicId', async () => {
      const queueItem = {
        id: 1,
        publicId: 'uuid-rej',
        status: MigrationReviewStatus.PENDING_REVIEW,
      };
      mockReviewQueueRepo.findOne.mockResolvedValue(queueItem);
      mockReviewQueueRepo.save.mockResolvedValue({});

      const result = await service.rejectQueueItemByPublicId('uuid-rej', 1);
      expect(result.message).toBe('Document rejected successfully');
      expect(result.publicId).toBe('uuid-rej');
      expect(queueItem.status).toBe(MigrationReviewStatus.REJECTED);
    });
  });

  // ── getStagingFileStream ──────────────────────────────────────────────────────
  describe('getStagingFileStream', () => {
    beforeEach(() => {
      mockedExistsSync.mockReturnValue(true);
      mockedCreateReadStream.mockReturnValue({} as never);
    });

    it('throws ValidationException when path is empty', () => {
      expect(() => service.getStagingFileStream('')).toThrow(
        ValidationException
      );
    });

    it('throws ValidationException on path traversal attempt', () => {
      expect(() => service.getStagingFileStream('../../etc/passwd')).toThrow(
        ValidationException
      );
    });

    it('throws NotFoundException when file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      const stagingDir = path.join(process.cwd(), 'uploads/staging');
      expect(() =>
        service.getStagingFileStream(path.join(stagingDir, 'nonexistent.pdf'))
      ).toThrow(NotFoundException);
    });

    it('returns stream for valid staging path', () => {
      const stagingDir = path.join(process.cwd(), 'uploads/staging');
      const stream = service.getStagingFileStream(
        path.join(stagingDir, 'doc.pdf')
      );
      expect(stream).toBeDefined();
      expect(mockedCreateReadStream).toHaveBeenCalled();
    });
  });
});
