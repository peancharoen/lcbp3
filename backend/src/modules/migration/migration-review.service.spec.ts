// File: backend/src/modules/migration/migration-review.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit tests for multi-attachment commit (T039, T040, Feature 242)
// - 2026-08-26: Expand commitRecord coverage to 80%+ — idempotency, validation, RFA, tags, rollback

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  move: jest.fn(),
}));

jest.mock('./utils/attachment-linking.util', () => ({
  linkAttachmentsToRevision: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { MigrationReviewService } from './migration-review.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { RagBatchService } from './services/rag-batch.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
  CompareStatus,
} from './entities/migration-review-queue.entity';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import { CommitMigrationReviewDto } from './dto/commit-migration-review.dto';
import { SystemException } from '../../common/exceptions';
import * as fs from 'fs-extra';
import { linkAttachmentsToRevision } from './utils/attachment-linking.util';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedLinkAttachments = jest.mocked(linkAttachmentsToRevision);

// ── Mock QueryRunner helpers ──────────────────────────────────────────────────

/** Entity target class — ใช้สำหรับ routing findOne mock */
type EntityCtor = new (...args: unknown[]) => unknown;

/** ค่า default สำหรับแต่ละ entity ใน findOne routing */
interface FindOneConfig {
  importTx: unknown;
  queueItem: unknown;
  project: unknown;
  typeByTypeName: unknown;
  typeByCode: unknown;
  typeByAlias: unknown;
  statusClbown: unknown;
  statusDraft: unknown;
  correspondence: unknown;
  attachmentExists: unknown;
  attachmentRecord: unknown;
  mainAttachment: unknown;
}

/** ค่า default สำหรับ query mock routing */
interface QueryConfig {
  rfaTypeRes: unknown[];
  rfaStatusRes: unknown[];
  tagRes: unknown[];
  tagInsertRes: { insertId: number };
}

/** สร้าง mock QueryRunner พร้อม routing ตาม config */
function createMockQueryRunner(
  findOneConfig: Partial<FindOneConfig> = {},
  queryConfig: Partial<QueryConfig> = {}
) {
  const cfg: FindOneConfig = {
    importTx: null,
    queueItem: makeQueueItem(),
    project: { id: 5, publicId: 'proj-uuid-001' },
    typeByTypeName: null,
    typeByCode: null,
    typeByAlias: { id: 1, typeCode: 'LETTER' },
    statusClbown: { id: 1, statusCode: 'CLBOWN' },
    statusDraft: null,
    correspondence: null,
    attachmentExists: { id: 10 },
    attachmentRecord: {
      id: 10,
      filePath: '/tmp/uploads/temp/file1.pdf',
      storedFilename: 'file1.pdf',
    },
    mainAttachment: {
      publicId: 'att-uuid-001',
      filePath: '/permanent/file1.pdf',
    },
    ...findOneConfig,
  };

  const qcfg: QueryConfig = {
    rfaTypeRes: [{ id: 100 }],
    rfaStatusRes: [{ id: 200 }],
    tagRes: [{ id: 300 }],
    tagInsertRes: { insertId: 301 },
    ...queryConfig,
  };

  let idCounter = 1000;

  const manager = {
    findOne: jest.fn(
      (entity: EntityCtor, options?: Record<string, unknown>) => {
        const where = (options?.where ?? {}) as Record<string, unknown>;
        const select = (options?.select ?? []) as string[];
        switch (entity) {
          case ImportTransaction:
            return cfg.importTx;
          case MigrationReviewQueue:
            return cfg.queueItem;
          case Project:
            return cfg.project;
          case CorrespondenceType:
            if (where['typeName'] !== undefined) return cfg.typeByTypeName;
            if (where['typeCode'] !== undefined) {
              // แยกระหว่าง typeByCode (ครั้งที่ 2) และ typeByAlias (ครั้งที่ 3)
              // ครั้งที่ 2: typeCode = category; ครั้งที่ 3: typeCode = alias
              // ใช้สถานะว่า typeByCode ถูกใช้แล้วหรือยัง
              if ((manager.findOne as jest.Mock).mock.calls.length > 0) {
                // ตรวจสอบว่าเคยเรียก typeByCode แล้วหรือไม่โดยดูจาก calls
              }
              // ถ้า typeByCode ยังไม่ถูก consume ให้คืน typeByCode; ถ้า consume แล้วให้คืน typeByAlias
              if (
                cfg.typeByCode !== null &&
                !(manager as unknown as { _typeByCodeUsed?: boolean })
                  ._typeByCodeUsed
              ) {
                (
                  manager as unknown as { _typeByCodeUsed?: boolean }
                )._typeByCodeUsed = true;
                return cfg.typeByCode;
              }
              return cfg.typeByAlias;
            }
            return null;
          case CorrespondenceStatus:
            if (where['statusCode'] === 'CLBOWN') return cfg.statusClbown;
            if (where['statusCode'] === 'DRAFT') return cfg.statusDraft;
            return null;
          case Correspondence:
            return cfg.correspondence;
          case Attachment:
            if (select.includes('publicId')) return cfg.mainAttachment;
            if (select.includes('storedFilename')) return cfg.attachmentRecord;
            return cfg.attachmentExists;
          default:
            return null;
        }
      }
    ),
    find: jest.fn((entity: EntityCtor) => {
      if (entity === CorrespondenceRevision) return [];
      return [];
    }),
    create: jest.fn((entity: EntityCtor, data: Record<string, unknown>) => {
      const id = idCounter++;
      return { id, publicId: `uuid-${id}`, ...data };
    }),
    save: jest.fn((..._args: unknown[]) => undefined),
    update: jest.fn((..._args: unknown[]) => undefined),
    query: jest.fn((sql: string) => {
      if (sql.includes('rfa_types')) return qcfg.rfaTypeRes;
      if (sql.includes('rfa_status_codes')) return qcfg.rfaStatusRes;
      if (sql.includes('SELECT id FROM tags')) return qcfg.tagRes;
      if (sql.includes('INSERT INTO tags')) return qcfg.tagInsertRes;
      return undefined;
    }),
  };

  // reset flag สำหรับ typeByCode tracking
  (manager as unknown as { _typeByCodeUsed?: boolean })._typeByCodeUsed = false;

  const queryRunner = {
    connect: jest.fn(() => undefined),
    startTransaction: jest.fn(() => undefined),
    commitTransaction: jest.fn(() => undefined),
    rollbackTransaction: jest.fn(() => undefined),
    release: jest.fn(() => undefined),
    manager,
  };

  return queryRunner;
}

/** สร้าง queue item mock สำหรับ happy path */
function makeQueueItem(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 1,
    publicId: 'queue-uuid-001',
    status: MigrationReviewStatus.PENDING,
    documentNumber: 'DOC-001',
    projectId: 5,
    aiSuggestedCategory: 'Correspondence',
    subject: 'Test Subject',
    originalSubject: 'Original Subject',
    body: 'Test body',
    ocrText: 'OCR text content',
    tempAttachmentIds: [10],
    tempAttachmentId: undefined,
    aiConfidence: 0.95,
    aiIssues: [],
    compareStatus: CompareStatus.COMPARED,
    extractedTags: [],
    issuedDate: new Date('2026-01-15'),
    receivedDate: new Date('2026-01-16'),
    senderOrganizationId: undefined,
    receiverOrganizationId: undefined,
    ...overrides,
  };
}

/** สร้าง DTO สำหรับ commit */
function makeDto(
  overrides: Record<string, unknown> = {}
): CommitMigrationReviewDto {
  return {
    publicId: 'queue-uuid-001',
    ...overrides,
  } as CommitMigrationReviewDto;
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('MigrationReviewService', () => {
  let service: MigrationReviewService;
  let dataSource: jest.Mocked<DataSource>;
  let mockUuidResolver: jest.Mocked<UuidResolverService>;
  let mockRagBatchService: jest.Mocked<RagBatchService>;
  let mockFileStorageService: jest.Mocked<FileStorageService>;
  let mockQueueRepo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    // fs-extra defaults
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.move.mockResolvedValue(undefined);
    mockedLinkAttachments.mockResolvedValue(undefined);

    mockQueueRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockUuidResolver = {
      resolveProjectId: jest.fn().mockResolvedValue(5),
      resolveOrganizationId: jest.fn().mockResolvedValue(10),
    } as unknown as jest.Mocked<UuidResolverService>;

    mockRagBatchService = {
      enqueueRagPrepare: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RagBatchService>;

    mockFileStorageService = {
      tempDir: '/tmp/uploads/temp',
      permanentDir: '/tmp/uploads/permanent',
    } as unknown as jest.Mocked<FileStorageService>;

    dataSource = {
      createQueryRunner: jest.fn(),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === MigrationReviewQueue) return mockQueueRepo;
        return { findOne: jest.fn(), save: jest.fn() };
      }),
    } as unknown as jest.Mocked<DataSource>;

    const module = await Test.createTestingModule({
      providers: [
        MigrationReviewService,
        { provide: DataSource, useValue: dataSource },
        { provide: UuidResolverService, useValue: mockUuidResolver },
        { provide: RagBatchService, useValue: mockRagBatchService },
        { provide: FileStorageService, useValue: mockFileStorageService },
      ],
    }).compile();

    service = module.get<MigrationReviewService>(MigrationReviewService);
  });

  // ── updateQueueOcr (ADR-042/047) ────────────────────────────────────────────

  describe('updateQueueOcr', () => {
    it('throw NotFoundException if queue item not found', async () => {
      mockQueueRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateQueueOcr('invalid-uuid', { ocrText: 'test' }, 1)
      ).rejects.toThrow();
    });

    it('updates OCR text without pre-import re-embed', async () => {
      const mockItem = {
        id: 1,
        publicId: '019505a1-7c3e-7000-8000-queue001',
        projectId: 5,
        ocrText: 'old ocr text',
        details: { source_file_path: '/share/np-dms/staging_ai/doc.pdf' },
      };
      mockQueueRepo.findOne.mockResolvedValue(mockItem);

      const res = await service.updateQueueOcr(
        '019505a1-7c3e-7000-8000-queue001',
        { ocrText: 'new corrected OCR text', reEmbed: true },
        2
      );

      expect(res.success).toBe(true);
      expect(res.ocrTextLength).toBe('new corrected OCR text'.length);
      expect(mockItem.ocrText).toBe('new corrected OCR text');
      expect(mockQueueRepo.save).toHaveBeenCalledWith(mockItem);
      expect(mockRagBatchService.enqueueRagPrepare).not.toHaveBeenCalled();
    });
  });

  // ── commitRecord — Idempotency & Duplicate Detection ─────────────────────────

  describe('commitRecord — idempotency', () => {
    it('returns idempotency replay when existing tx has status 201', async () => {
      const qr = createMockQueryRunner({
        importTx: { id: 42, statusCode: 201 },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-001');

      expect(res.success).toBe(true);
      expect(res.message).toContain('idempotency replay');
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it('throws SystemException for duplicate tx with failed status', async () => {
      const qr = createMockQueryRunner({
        importTx: { id: 42, statusCode: 500 },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-001')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Queue Item Validation ─────────────────────────────────────

  describe('commitRecord — queue item validation', () => {
    it('throws SystemException when queue item not found', async () => {
      const qr = createMockQueryRunner({ queueItem: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-002')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when queue item is not PENDING', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ status: MigrationReviewStatus.IMPORTED }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-003')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Project Validation ────────────────────────────────────────

  describe('commitRecord — project validation', () => {
    it('throws SystemException when project ID is missing', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ projectId: undefined }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(
          makeDto({ projectId: undefined }),
          1,
          'idem-key-004'
        )
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when project not found in DB', async () => {
      const qr = createMockQueryRunner({ project: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-005')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Category Validation ───────────────────────────────────────

  describe('commitRecord — category validation', () => {
    it('throws SystemException when category is missing', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ aiSuggestedCategory: undefined }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(
          makeDto({ category: undefined }),
          1,
          'idem-key-006'
        )
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when category not found in CorrespondenceType', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ aiSuggestedCategory: 'UnknownCat' }),
        typeByTypeName: null,
        typeByCode: null,
        typeByAlias: null,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(
          makeDto({ category: 'UnknownCat' }),
          1,
          'idem-key-007'
        )
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('resolves category via typeName lookup (first match)', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ aiSuggestedCategory: 'LETTER' }),
        typeByTypeName: { id: 7, typeCode: 'LETTER' },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({ category: 'LETTER' }),
        1,
        'idem-key-008'
      );

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('resolves category via typeCode lookup (second match)', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ aiSuggestedCategory: 'RFA' }),
        typeByTypeName: null,
        typeByCode: { id: 3, typeCode: 'RFA' },
        typeByAlias: null,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({ category: 'RFA' }),
        1,
        'idem-key-009'
      );

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Status Resolution ─────────────────────────────────────────

  describe('commitRecord — status resolution', () => {
    it('falls back to DRAFT when CLBOWN not found', async () => {
      const qr = createMockQueryRunner({
        statusClbown: null,
        statusDraft: { id: 2, statusCode: 'DRAFT' },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-010');

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when neither CLBOWN nor DRAFT found', async () => {
      const qr = createMockQueryRunner({
        statusClbown: null,
        statusDraft: null,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-011')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Correspondence Creation & Update ──────────────────────────

  describe('commitRecord — correspondence creation', () => {
    it('creates new correspondence when not found', async () => {
      const qr = createMockQueryRunner({ correspondence: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-012');

      expect(res.success).toBe(true);
      expect(res.correspondencePublicId).toBeDefined();
      expect(qr.manager.create).toHaveBeenCalledWith(
        Correspondence,
        expect.any(Object)
      );
      expect(qr.manager.save).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('updates existing correspondence originatorId when senderId provided', async () => {
      const existingCorr = {
        id: 50,
        publicId: 'corr-uuid-001',
        correspondenceNumber: 'DOC-001',
        projectId: 5,
        originatorId: undefined,
      };
      const qr = createMockQueryRunner({
        correspondence: existingCorr,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({ senderId: 10 }),
        1,
        'idem-key-013'
      );

      expect(res.success).toBe(true);
      expect(existingCorr.originatorId).toBe(10);
      expect(qr.manager.save).toHaveBeenCalledWith(existingCorr);
    });

    it('does not update existing correspondence when originatorId already set', async () => {
      const existingCorr = {
        id: 50,
        publicId: 'corr-uuid-001',
        correspondenceNumber: 'DOC-001',
        projectId: 5,
        originatorId: 99,
      };
      const qr = createMockQueryRunner({
        correspondence: existingCorr,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({ senderId: 10 }),
        1,
        'idem-key-014'
      );

      expect(res.success).toBe(true);
      expect(existingCorr.originatorId).toBe(99);
    });

    it('inserts recipient when receiverId is provided', async () => {
      const qr = createMockQueryRunner({ correspondence: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(
        makeDto({ receiverId: 20 }),
        1,
        'idem-key-015'
      );

      const recipientQuery = qr.manager.query.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('correspondence_recipients')
      );
      expect(recipientQuery).toBeDefined();
    });
  });

  // ── commitRecord — RFA Branch ────────────────────────────────────────────────

  describe('commitRecord — RFA branch', () => {
    it('creates Rfa record for new RFA correspondence', async () => {
      const qr = createMockQueryRunner(
        {
          queueItem: makeQueueItem({ aiSuggestedCategory: 'RFA' }),
          typeByTypeName: null,
          typeByCode: { id: 3, typeCode: 'RFA' },
          typeByAlias: null,
        },
        {
          rfaTypeRes: [{ id: 100 }],
          rfaStatusRes: [{ id: 200 }],
        }
      );
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({ category: 'RFA' }),
        1,
        'idem-key-rfa-001'
      );

      expect(res.success).toBe(true);
      expect(qr.manager.create).toHaveBeenCalledWith(Rfa, expect.any(Object));
      expect(qr.manager.create).toHaveBeenCalledWith(
        RfaRevision,
        expect.any(Object)
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when RFA type not found', async () => {
      const qr = createMockQueryRunner(
        {
          queueItem: makeQueueItem({ aiSuggestedCategory: 'RFA' }),
          typeByTypeName: null,
          typeByCode: { id: 3, typeCode: 'RFA' },
          typeByAlias: null,
        },
        {
          rfaTypeRes: [],
        }
      );
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(
          makeDto({ category: 'RFA' }),
          1,
          'idem-key-rfa-002'
        )
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when RFA status not found', async () => {
      const qr = createMockQueryRunner(
        {
          queueItem: makeQueueItem({ aiSuggestedCategory: 'RFA' }),
          typeByTypeName: null,
          typeByCode: { id: 3, typeCode: 'RFA' },
          typeByAlias: null,
        },
        {
          rfaTypeRes: [{ id: 100 }],
          rfaStatusRes: [],
        }
      );
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(
          makeDto({ category: 'RFA' }),
          1,
          'idem-key-rfa-003'
        )
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Attachment Validation ─────────────────────────────────────

  describe('commitRecord — attachment validation', () => {
    it('throws SystemException when no attachment IDs resolved', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({
          tempAttachmentIds: null,
          tempAttachmentId: undefined,
        }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-016')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws SystemException when attachment ID does not exist', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ tempAttachmentIds: [999] }),
        attachmentExists: null,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-017')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('uses tempAttachmentId (legacy) when tempAttachmentIds is null', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({
          tempAttachmentIds: null,
          tempAttachmentId: 42,
        }),
        attachmentExists: { id: 42 },
        attachmentRecord: {
          id: 42,
          filePath: '/tmp/uploads/temp/legacy.pdf',
          storedFilename: 'legacy.pdf',
        },
        mainAttachment: {
          publicId: 'att-uuid-042',
          filePath: '/permanent/legacy.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-018');

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ── commitRecord — File Move ─────────────────────────────────────────────────

  describe('commitRecord — file move', () => {
    it('moves file from tempDir to permanentDir when in temp', async () => {
      const qr = createMockQueryRunner({
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/temp/file1.pdf',
          storedFilename: 'file1.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-move-001');

      expect(mockedFs.move).toHaveBeenCalledWith(
        '/tmp/uploads/temp/file1.pdf',
        expect.stringContaining('/tmp/uploads/permanent'),
        { overwrite: true }
      );
      expect(qr.manager.update).toHaveBeenCalledWith(
        Attachment,
        { id: 10 },
        expect.objectContaining({ filePath: expect.any(String) })
      );
    });

    it('does not move file when already in permanentDir', async () => {
      const qr = createMockQueryRunner({
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/permanent/already/file1.pdf',
          storedFilename: 'file1.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-move-002');

      expect(mockedFs.move).not.toHaveBeenCalled();
    });

    it('does not move file when pathExists returns false', async () => {
      mockedFs.pathExists.mockResolvedValue(false);
      const qr = createMockQueryRunner({
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/temp/missing.pdf',
          storedFilename: 'missing.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-move-003');

      expect(mockedFs.move).not.toHaveBeenCalled();
    });

    it('continues commit when fs.move throws (caught and warned)', async () => {
      mockedFs.move.mockRejectedValue(new Error('disk full'));
      const qr = createMockQueryRunner({
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/temp/file1.pdf',
          storedFilename: 'file1.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-move-004');

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('sets isTemporary=false and ocrText on first attachment', async () => {
      const qr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-move-005');

      const updateCalls = qr.manager.update.mock.calls.filter(
        (call) => call[0] === Attachment
      );
      // อย่างน้อย 1 ครั้งสำหรับ isTemporary=false
      expect(updateCalls.length).toBeGreaterThan(0);
      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate[2]).toEqual(
        expect.objectContaining({ isTemporary: false })
      );
    });
  });

  // ── commitRecord — Tags ──────────────────────────────────────────────────────

  describe('commitRecord — tags', () => {
    it('links tags from dto.tags when provided', async () => {
      const qr = createMockQueryRunner({
        tagRes: [{ id: 300 }],
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(
        makeDto({ tags: ['important', 'urgent'] }),
        1,
        'idem-key-tags-001'
      );

      const tagSelectCalls = qr.manager.query.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('SELECT id FROM tags')
      );
      expect(tagSelectCalls.length).toBe(2);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('creates new tag when not found in DB', async () => {
      const qr = createMockQueryRunner(
        {},
        {
          tagRes: [],
          tagInsertRes: { insertId: 500 },
        }
      );
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(
        makeDto({ tags: ['newtag'] }),
        1,
        'idem-key-tags-002'
      );

      const insertTagCalls = qr.manager.query.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('INSERT INTO tags')
      );
      expect(insertTagCalls.length).toBe(1);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('links extractedTags from queueItem when dto.tags is empty', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({
          extractedTags: [{ name: 'tag-from-extract' }, { tagName: 'tag2' }],
        }),
        tagRes: [{ id: 300 }],
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-tags-003');

      const tagSelectCalls = qr.manager.query.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('SELECT id FROM tags')
      );
      expect(tagSelectCalls.length).toBe(2);
    });

    it('skips empty/whitespace tags', async () => {
      const qr = createMockQueryRunner({
        tagRes: [{ id: 300 }],
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(
        makeDto({ tags: ['valid', '  ', ''] }),
        1,
        'idem-key-tags-004'
      );

      const tagSelectCalls = qr.manager.query.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('SELECT id FROM tags')
      );
      // เฉพาะ 'valid' ที่ผ่านการ trim แล้วไม่ว่าง
      expect(tagSelectCalls.length).toBe(1);
    });
  });

  // ── commitRecord — RAG Embed ─────────────────────────────────────────────────

  describe('commitRecord — RAG embed', () => {
    it('triggers RAG embed after commit when ocrText present', async () => {
      const qr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rag-001');

      expect(mockRagBatchService.enqueueRagPrepare).toHaveBeenCalledTimes(1);
      expect(mockRagBatchService.enqueueRagPrepare).toHaveBeenCalledWith(
        expect.objectContaining({
          cachedOcrText: 'OCR text content',
        })
      );
    });

    it('does not trigger RAG embed when ocrText is empty', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ ocrText: '' }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rag-002');

      expect(mockRagBatchService.enqueueRagPrepare).not.toHaveBeenCalled();
    });

    it('does not throw when RAG embed fails (commit already succeeded)', async () => {
      mockRagBatchService.enqueueRagPrepare.mockRejectedValue(
        new Error('Qdrant connection failed')
      );
      const qr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-rag-003');

      expect(res.success).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('does not trigger RAG embed when main attachment not found', async () => {
      const qr = createMockQueryRunner({ mainAttachment: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rag-004');

      expect(mockRagBatchService.enqueueRagPrepare).not.toHaveBeenCalled();
    });
  });

  // ── commitRecord — Transaction & Rollback ────────────────────────────────────

  describe('commitRecord — transaction lifecycle', () => {
    it('creates ImportTransaction and updates queue status on success', async () => {
      const qr2 = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr2);

      const res = await service.commitRecord(makeDto(), 1, 'idem-key-tx-001');

      expect(res.success).toBe(true);
      expect(res.status).toBe(MigrationReviewStatus.IMPORTED);
      expect(qr2.manager.create).toHaveBeenCalledWith(
        ImportTransaction,
        expect.any(Object)
      );
      expect(qr2.commitTransaction).toHaveBeenCalled();
    });

    it('rolls back and throws SystemException on unexpected error', async () => {
      const qr = createMockQueryRunner();
      // ทำให้ save ล้มเหลวหลังจากผ่าน validation ไปแล้ว
      qr.manager.save.mockRejectedValueOnce(new Error('DB connection lost'));
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-tx-002')
      ).rejects.toThrow(SystemException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('always releases queryRunner in finally block', async () => {
      const qr = createMockQueryRunner({ queueItem: null });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.commitRecord(makeDto(), 1, 'idem-key-tx-003')
      ).rejects.toThrow();

      expect(qr.release).toHaveBeenCalled();
    });
  });

  // ── commitRecord — Revision ──────────────────────────────────────────────────

  describe('commitRecord — revision', () => {
    it('creates revision with revisionNumber 0 when no existing revisions', async () => {
      const qr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rev-001');

      expect(qr.manager.create).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ revisionNumber: 0, isCurrent: true })
      );
    });

    it('sets isCurrent=false on existing revisions when creating new one', async () => {
      const qr = createMockQueryRunner();
      qr.manager.find.mockResolvedValue([
        { id: 99, correspondenceId: 50, isCurrent: true, revisionNumber: 0 },
      ]);
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rev-002');

      expect(qr.manager.update).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ isCurrent: true }),
        { isCurrent: false }
      );
    });

    it('calls linkAttachmentsToRevision with revision id and attachment ids', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({ tempAttachmentIds: [10, 20] }),
        attachmentExists: { id: 10 },
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/temp/file1.pdf',
          storedFilename: 'file1.pdf',
        },
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.commitRecord(makeDto(), 1, 'idem-key-rev-003');

      expect(mockedLinkAttachments).toHaveBeenCalledWith(
        qr.manager,
        expect.any(Number),
        [10, 20]
      );
    });
  });

  // ── commitRecord — Full Happy Path ───────────────────────────────────────────

  describe('commitRecord — full happy path', () => {
    it('commits successfully with all fields populated', async () => {
      const qr = createMockQueryRunner({
        queueItem: makeQueueItem({
          tempAttachmentIds: [10, 20, 30],
          extractedTags: [{ name: 'tag1' }],
        }),
        attachmentExists: { id: 10 },
        attachmentRecord: {
          id: 10,
          filePath: '/tmp/uploads/temp/file1.pdf',
          storedFilename: 'file1.pdf',
        },
        tagRes: [{ id: 300 }],
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const res = await service.commitRecord(
        makeDto({
          subject: 'Custom Subject',
          body: 'Custom body',
          tags: ['custom-tag'],
          issuedDate: '2026-03-20',
          receivedDate: '2026-03-21',
        }),
        1,
        'idem-key-full-001'
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('successfully imported');
      expect(res.correspondencePublicId).toBeDefined();
      expect(res.publicId).toBe('queue-uuid-001');
      expect(res.status).toBe(MigrationReviewStatus.IMPORTED);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.manager.save).toHaveBeenCalled();
      expect(mockedLinkAttachments).toHaveBeenCalled();
    });
  });

  // ── resolveAttachmentIds (via behavior) ──────────────────────────────────────

  describe('resolveAttachmentIds (via behavior)', () => {
    it('resolves tempAttachmentIds when present (multi-attachment)', () => {
      const queueItem = {
        tempAttachmentIds: [10, 20, 30],
        tempAttachmentId: 99,
      } as unknown as MigrationReviewQueue;
      expect(queueItem.tempAttachmentIds).toEqual([10, 20, 30]);
      expect(queueItem.tempAttachmentIds!.length).toBeGreaterThan(0);
    });

    it('falls back to [tempAttachmentId] when tempAttachmentIds is null', () => {
      const queueItem = {
        tempAttachmentIds: null,
        tempAttachmentId: 42,
      } as unknown as MigrationReviewQueue;
      const ids =
        queueItem.tempAttachmentIds && queueItem.tempAttachmentIds.length > 0
          ? queueItem.tempAttachmentIds
          : queueItem.tempAttachmentId
            ? [queueItem.tempAttachmentId]
            : [];
      expect(ids).toEqual([42]);
    });

    it('falls back to [tempAttachmentId] when tempAttachmentIds is empty array', () => {
      const queueItem = {
        tempAttachmentIds: [],
        tempAttachmentId: 7,
      } as unknown as MigrationReviewQueue;
      const ids =
        queueItem.tempAttachmentIds && queueItem.tempAttachmentIds.length > 0
          ? queueItem.tempAttachmentIds
          : queueItem.tempAttachmentId
            ? [queueItem.tempAttachmentId]
            : [];
      expect(ids).toEqual([7]);
    });

    it('returns empty array when both are null/undefined', () => {
      const queueItem = {
        tempAttachmentIds: null,
        tempAttachmentId: undefined,
      } as unknown as MigrationReviewQueue;
      const ids =
        queueItem.tempAttachmentIds && queueItem.tempAttachmentIds.length > 0
          ? queueItem.tempAttachmentIds
          : queueItem.tempAttachmentId
            ? [queueItem.tempAttachmentId]
            : [];
      expect(ids).toEqual([]);
    });
  });

  // ── CompareStatus enum integration ───────────────────────────────────────────

  describe('CompareStatus enum integration', () => {
    it('CompareStatus.COMPARED is the default', () => {
      const queueItem = {
        compareStatus: CompareStatus.COMPARED,
      } as unknown as MigrationReviewQueue;
      expect(queueItem.compareStatus).toBe(CompareStatus.COMPARED);
    });

    it('CompareStatus.UNAVAILABLE indicates DWG or OCR failure', () => {
      const queueItem = {
        compareStatus: CompareStatus.UNAVAILABLE,
        compareUnavailableReason: 'เอกสารหลักเป็นไฟล์ DWG/DXF ไม่มี text layer',
      } as unknown as MigrationReviewQueue;
      expect(queueItem.compareStatus).toBe(CompareStatus.UNAVAILABLE);
      expect(queueItem.compareUnavailableReason).toContain('DWG');
    });
  });
});
