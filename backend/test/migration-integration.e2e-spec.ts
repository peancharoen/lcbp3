// File: backend/test/migration-integration.e2e-spec.ts
// Change Log:
// - 2026-09-11: สร้าง Integration Test สำหรับ End-to-End Migration Flow (Phase 3A)
//   ทดสอบการเชื่อมต่อระหว่าง services: LegacyIngestion → Staging Queue →
//   Start Extract → Approve → Correspondence → RAG re-embed

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

import { MigrationService } from '../src/modules/migration/migration.service';
import { MigrationReviewService } from '../src/modules/migration/migration-review.service';
import { LegacyIngestionService } from '../src/modules/migration/services/legacy-ingestion.service';
import { RagBatchService } from '../src/modules/migration/services/rag-batch.service';
import { ReviewThresholdService } from '../src/modules/migration/services/review-threshold.service';
import { MetadataResolutionService } from '../src/modules/migration/services/metadata-resolution.service';
import { FileStorageService } from '../src/common/file-storage/file-storage.service';
import { UuidResolverService } from '../src/common/services/uuid-resolver.service';
import { SearchService } from '../src/modules/search/search.service';

import { ImportTransaction } from '../src/modules/migration/entities/import-transaction.entity';
import { Correspondence } from '../src/modules/correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../src/modules/correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../src/modules/correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../src/modules/correspondence/entities/correspondence-status.entity';
import { Project } from '../src/modules/project/entities/project.entity';
import { Organization } from '../src/modules/organization/entities/organization.entity';
import { Discipline } from '../src/modules/master/entities/discipline.entity';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { User } from '../src/modules/user/entities/user.entity';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
  MigrationAiStatus,
} from '../src/modules/migration/entities/migration-review-queue.entity';
import { MigrationError } from '../src/modules/migration/entities/migration-error.entity';
import { MigrationProgress } from '../src/modules/ai/entities/migration-progress.entity';
import { Rfa } from '../src/modules/rfa/entities/rfa.entity';
import { RfaRevision } from '../src/modules/rfa/entities/rfa-revision.entity';
import { AiAuditLog } from '../src/modules/ai/entities/ai-audit-log.entity';
import { Tag } from '../src/modules/tags/entities/tag.entity';
import { CorrespondenceTag } from '../src/modules/tags/entities/correspondence-tag.entity';
import { SystemSetting } from '../src/modules/ai/entities/system-setting.entity';
import { CorrespondenceRecipient } from '../src/modules/correspondence/entities/correspondence-recipient.entity';
import { CleanExpiredStashesWorker } from '../src/modules/migration/workers/clean-expired-stashes.worker';
import { ExpirePendingReviewsWorker } from '../src/modules/migration/workers/expire-pending-reviews.worker';
import { linkAttachmentsToRevision } from '../src/modules/migration/utils/attachment-linking.util';

/**
 * Integration tests สำหรับ End-to-End Migration Flow (Phase 3A)
 * ทดสอบการเชื่อมต่อระหว่าง services โดยใช้ mock repositories
 * ไม่ต้อง Qdrant/Redis/OCR sidecar จริง
 */
describe('Migration Integration Flow (Phase 3A)', () => {
  let migrationService: MigrationService;
  let migrationReviewService: MigrationReviewService;
  let legacyIngestionService: LegacyIngestionService;
  let ragBatchService: RagBatchService;

  const tempTestDir = path.join(__dirname, '__temp_migration_integration__');
  const tempExcelPath = path.join(tempTestDir, 'integration-test.xlsx');
  const tempPdfPath = path.join(tempTestDir, 'DOC-INT-001.pdf');

  // Mock repositories
  const makeMockRepo = <T>(): jest.Mocked<Repository<T>> =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto: unknown) => dto),
      save: jest.fn((entity: unknown) => Promise.resolve({ ...entity, id: 1 })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    }) as unknown as jest.Mocked<Repository<T>>;

  const reviewQueueRepo = makeMockRepo<MigrationReviewQueue>();
  const importTxRepo = makeMockRepo<ImportTransaction>();
  const correspondenceRepo = makeMockRepo<Correspondence>();
  const correspondenceTypeRepo = makeMockRepo<CorrespondenceType>();
  const correspondenceStatusRepo = makeMockRepo<CorrespondenceStatus>();
  const projectRepo = makeMockRepo<Project>();
  const organizationRepo = makeMockRepo<Organization>();
  const disciplineRepo = makeMockRepo<Discipline>();
  const errorRepo = makeMockRepo<MigrationError>();
  const progressRepo = makeMockRepo<MigrationProgress>();
  const attachmentRepo = makeMockRepo<Attachment>();
  const userRepo = makeMockRepo<User>();
  const rfaRepo = makeMockRepo<Rfa>();
  const rfaRevisionRepo = makeMockRepo<RfaRevision>();
  const aiAuditLogRepo = makeMockRepo<AiAuditLog>();
  const tagRepo = makeMockRepo<Tag>();
  const correspondenceTagRepo = makeMockRepo<CorrespondenceTag>();
  const systemSettingRepo = makeMockRepo<SystemSetting>();
  const correspondenceRevisionRepo = makeMockRepo<CorrespondenceRevision>();
  const correspondenceRecipientRepo = makeMockRepo<CorrespondenceRecipient>();

  // Mock DataSource with queryRunner
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dto: unknown) => dto),
      save: jest.fn((entity: unknown) => Promise.resolve({ ...entity, id: 1 })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        save: jest.fn(),
      }),
    },
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    getRepository: jest.fn().mockReturnValue(reviewQueueRepo),
    query: jest.fn().mockResolvedValue([]),
  } as unknown as DataSource;

  // Mock Queue
  const mockAiBatchQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-int-001' }),
    getJob: jest.fn().mockResolvedValue(null),
  } as unknown as Queue;

  // Mock services
  const mockFileStorageService = {
    moveFile: jest.fn().mockResolvedValue('/permanent/path.pdf'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    permanentDir: '/tmp/permanent',
    tempDir: '/tmp/temp',
  } as unknown as FileStorageService;

  const mockUuidResolverService = {
    resolveProjectId: jest.fn().mockResolvedValue(5),
    resolveCorrespondenceId: jest.fn(),
    resolveAttachmentId: jest.fn(),
  } as unknown as UuidResolverService;

  const mockSearchService = {
    indexCorrespondence: jest.fn().mockResolvedValue(undefined),
    indexDocument: jest.fn().mockResolvedValue(undefined),
  } as unknown as SearchService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  // Mock Redis (สำหรับ ReviewThresholdService)
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  };

  beforeAll(async () => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
    fs.writeFileSync(tempPdfPath, '%PDF-1.4 dummy content');

    // สร้างไฟล์ Excel สำหรับ integration test
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow([
      'ลำดับ',
      'เลขที่เอกสาร',
      'เรื่อง',
      'วันที่ออก',
      'วันที่รับ',
      'จาก',
      'ถึง',
      'หมวดหมู่',
      'ชื่อไฟล์',
      'หมายเหตุ',
    ]);
    worksheet.addRow([
      1,
      'INT-DOC-001',
      'Integration test document',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      'Letter',
      'DOC-INT-001.pdf',
      '',
    ]);
    await workbook.xlsx.writeFile(tempExcelPath);
  });

  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        MigrationReviewService,
        LegacyIngestionService,
        RagBatchService,
        ReviewThresholdService,
        MetadataResolutionService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: importTxRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: correspondenceTypeRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: correspondenceStatusRepo,
        },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: reviewQueueRepo,
        },
        { provide: getRepositoryToken(MigrationError), useValue: errorRepo },
        {
          provide: getRepositoryToken(MigrationProgress),
          useValue: progressRepo,
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: organizationRepo,
        },
        { provide: getRepositoryToken(Discipline), useValue: disciplineRepo },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(Correspondence),
          useValue: correspondenceRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useValue: correspondenceRevisionRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRecipient),
          useValue: correspondenceRecipientRepo,
        },
        { provide: getRepositoryToken(Rfa), useValue: rfaRepo },
        { provide: getRepositoryToken(RfaRevision), useValue: rfaRevisionRepo },
        { provide: getRepositoryToken(AiAuditLog), useValue: aiAuditLogRepo },
        { provide: getRepositoryToken(Tag), useValue: tagRepo },
        {
          provide: getRepositoryToken(CorrespondenceTag),
          useValue: correspondenceTagRepo,
        },
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: systemSettingRepo,
        },
        { provide: 'BullQueue_ai-batch', useValue: mockAiBatchQueue },
        { provide: 'BullQueue_ai-rag-ingest', useValue: mockAiBatchQueue },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: UuidResolverService, useValue: mockUuidResolverService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    migrationService = module.get<MigrationService>(MigrationService);
    migrationReviewService = module.get<MigrationReviewService>(
      MigrationReviewService
    );
    legacyIngestionService = module.get<LegacyIngestionService>(
      LegacyIngestionService
    );
    ragBatchService = module.get<RagBatchService>(RagBatchService);
  });

  // ─── 3A.1: LegacyIngestion → Staging Queue (PENDING) ──────────────────────

  it('3A.1: LegacyIngestion → รายการปรากฏใน migration_review_queue สถานะ PENDING', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);
    // LegacyIngestionService ต้องการ correspondenceTypeRepo.find()
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, typeCode: 'RFA', typeName: 'Request for Approval' },
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);

    const result = await legacyIngestionService.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.enqueuedCount).toBe(1);

    // ตรวจสอบว่า save ลง review queue ด้วยสถานะ PENDING
    const savedEntity = reviewQueueRepo.save.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(savedEntity.status).toBe(MigrationReviewStatus.PENDING);
    expect(savedEntity.documentNumber).toBe('INT-DOC-001');
  });

  // ─── 3A.2: Staging Queue → BullMQ ai-batch → OCR + AI enrichment ───────────

  it('3A.2: startExtractQueueItem → enqueue BullMQ ai-batch job', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 100,
      publicId: '019505a1-7c3e-7000-8000-queue001',
      status: MigrationReviewStatus.PENDING,
      aiStatus: null,
      aiJobId: null,
      documentNumber: 'INT-DOC-001',
      projectId: 5,
      details: { source_file_path: tempPdfPath },
    });
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
    });

    const result = await migrationService.startExtractQueueItem(
      '019505a1-7c3e-7000-8000-queue001',
      'idem-extract-001',
      42
    );

    expect(mockAiBatchQueue.add).toHaveBeenCalledWith(
      'legacy-ai-enrichment',
      expect.objectContaining({
        jobType: 'legacy-ai-enrichment',
        queuePublicId: '019505a1-7c3e-7000-8000-queue001',
        documentNumber: 'INT-DOC-001',
      }),
      expect.objectContaining({
        jobId: expect.stringContaining('legacy-enrich-'),
        attempts: 3,
      })
    );
    expect(result).toHaveProperty('jobId');
  });

  it('3A.2b: startExtractQueueItem → ปฏิเสธถ้า status != PENDING', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 101,
      publicId: '019505a1-7c3e-7000-8000-queue002',
      status: MigrationReviewStatus.IMPORTED,
      aiStatus: MigrationAiStatus.DONE,
      aiJobId: 'old-job',
    });

    await expect(
      migrationService.startExtractQueueItem(
        '019505a1-7c3e-7000-8000-queue002',
        'idem-extract-002',
        42
      )
    ).rejects.toThrow();

    expect(mockAiBatchQueue.add).not.toHaveBeenCalled();
  });

  it('3A.2c: startExtractQueueItem → skip ถ้า AI extraction กำลังรัน (RUNNING)', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 102,
      publicId: '019505a1-7c3e-7000-8000-queue003',
      status: MigrationReviewStatus.PENDING,
      aiStatus: MigrationAiStatus.RUNNING,
      aiJobId: 'running-job-001',
    });

    const result = await migrationService.startExtractQueueItem(
      '019505a1-7c3e-7000-8000-queue003',
      'idem-extract-003',
      42
    );

    expect(result).toHaveProperty(
      'message',
      'AI extraction already running or queued'
    );
    expect(mockAiBatchQueue.add).not.toHaveBeenCalled();
  });

  // ─── 3A.3: Review Queue → Approve → Correspondence created ────────────────

  it('3A.3: approveQueueItemByPublicId → Correspondence สร้าง + status IMPORTED', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 200,
      publicId: '019505a1-7c3e-7000-8000-queue004',
      status: MigrationReviewStatus.PENDING_REVIEW,
      documentNumber: 'INT-DOC-001',
      ocrText: 'OCR text from document',
      aiSummary: 'AI summary',
      projectId: 5,
      tempAttachmentId: 99,
    });

    // Spy on importCorrespondence เพื่อไม่ต้อง mock ทั้ง flow
    const importSpy = jest
      .spyOn(migrationService, 'importCorrespondence')
      .mockResolvedValue({
        message: 'Success',
        transaction: { id: 500, statusCode: 201 },
      } as never);

    const result = await migrationService.approveQueueItemByPublicId(
      '019505a1-7c3e-7000-8000-queue004',
      {
        documentNumber: 'INT-DOC-001',
        subject: 'Integration test document',
        correspondenceType: 'LETTER',
        sourceFilePath: '/staging/test.pdf',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-INT-001',
        projectId: 5,
      },
      'idem-approve-001',
      42
    );

    // importCorrespondence ถูกเรียก
    expect(importSpy).toHaveBeenCalled();
    // Queue item status เปลี่ยนเป็น IMPORTED
    expect(reviewQueueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MigrationReviewStatus.IMPORTED,
        reviewedBy: '42',
      })
    );
    expect(result).toHaveProperty('message');
  });

  it('3A.3b: approveQueueItemByPublicId → ปฏิเสธถ้า status != PENDING_REVIEW', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 201,
      publicId: '019505a1-7c3e-7000-8000-queue005',
      status: MigrationReviewStatus.PENDING,
    });

    await expect(
      migrationService.approveQueueItemByPublicId(
        '019505a1-7c3e-7000-8000-queue005',
        {
          documentNumber: 'INT-DOC-002',
          subject: 'Test',
          correspondenceType: 'LETTER',
          sourceFilePath: '/staging/test.pdf',
          migratedBy: 'SYSTEM_IMPORT',
          batchId: 'BATCH-INT-002',
          projectId: 5,
        },
        'idem-approve-002',
        42
      )
    ).rejects.toThrow();
  });

  it('3A.3-idem: approveQueueItemByPublicId ซ้ำด้วย Idempotency-Key เดิม → คืน cached result', async () => {
    reviewQueueRepo.findOne.mockResolvedValue({
      id: 202,
      publicId: '019505a1-7c3e-7000-8000-queue007',
      status: MigrationReviewStatus.PENDING_REVIEW,
      documentNumber: 'INT-DOC-004',
      projectId: 5,
    });
    importTxRepo.findOne.mockResolvedValue({
      id: 999,
      idempotencyKey: 'idem-dup-001',
      statusCode: 201,
    });

    const result = await migrationService.approveQueueItemByPublicId(
      '019505a1-7c3e-7000-8000-queue007',
      {
        documentNumber: 'INT-DOC-004',
        subject: 'Test',
        correspondenceType: 'LETTER',
        sourceFilePath: '/staging/test.pdf',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'BATCH-INT-003',
        projectId: 5,
      },
      'idem-dup-001',
      42
    );

    expect(result).toHaveProperty('message', 'Already processed');
    // ไม่ควรสร้าง Correspondence ใหม่
    expect(correspondenceRepo.save).not.toHaveBeenCalled();
  });

  // ─── 3A.4: Commit → RAG re-embed triggered ────────────────────────────────

  it('3A.4: commitRecord → RAG re-embed job ถูกสร้างหลัง commit Correspondence', async () => {
    const queueItem = {
      id: 300,
      publicId: '019505a1-7c3e-7000-8000-queue006',
      status: MigrationReviewStatus.PENDING_REVIEW,
      documentNumber: 'INT-DOC-003',
      ocrText: 'OCR text',
      aiSummary: 'AI summary',
      projectId: 5,
      aiSuggestedCorrespondenceType: 'LETTER',
      details: {
        metadata: {
          confidence: {
            ocrQuality: 0.95,
            summary: 0.9,
            correspondenceType: 0.9,
            tags: 0.9,
          },
        },
      },
      tempAttachmentId: 88,
    };

    mockQueryRunner.manager.findOne.mockImplementation((entity: unknown) => {
      const e = entity as { name: string };
      if (e.name === 'ImportTransaction') return Promise.resolve(null);
      if (e.name === 'MigrationReviewQueue') return Promise.resolve(queueItem);
      if (e.name === 'Project')
        return Promise.resolve({ id: 5, publicId: 'proj-001' });
      if (e.name === 'CorrespondenceType')
        return Promise.resolve({
          id: 1,
          typeCode: 'LETTER',
          typeName: 'Letter',
        });
      if (e.name === 'CorrespondenceStatus')
        return Promise.resolve({ id: 1, statusCode: 'CLBOWN' });
      if (e.name === 'Attachment')
        return Promise.resolve({ id: 88, filePath: '/tmp/test.pdf' });
      return Promise.resolve(null);
    });
    mockQueryRunner.manager.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    // Mock migrationService.isLegacyExtractionShape → false
    jest
      .spyOn(migrationService, 'isLegacyExtractionShape')
      .mockReturnValue(false);
    jest
      .spyOn(migrationService, 'getAllowedCategoryCodes')
      .mockResolvedValue(['LETTER', 'RFA', 'OTHER']);

    const ragBatchSpy = jest
      .spyOn(ragBatchService, 'enqueueRagPrepare')
      .mockResolvedValue(undefined);

    await migrationReviewService.commitRecord(
      {
        publicId: '019505a1-7c3e-7000-8000-queue006',
        projectId: 5,
        correspondenceType: 'LETTER',
        ocrText: 'OCR text',
        tagDecisions: [],
      } as never,
      42,
      'idem-commit-001'
    );

    // RAG batch ถูก trigger
    expect(ragBatchSpy).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // ─── 3A.5: Multi-attachment linking ───────────────────────────────────────

  it('3A.5: linkAttachmentsToRevision → ไฟล์แนบทั้ง 3 ผูกกับ revision เดียวกัน', async () => {
    const mockManager = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await linkAttachmentsToRevision(mockManager as never, 500, [101, 102, 103]);

    // query ถูกเรียก 3 ครั้ง (หนึ่งครั้งต่อ attachment)
    expect(mockManager.query).toHaveBeenCalledTimes(3);
    // ตรวจสอบว่า attachment แรกคือเอกสารหลัก (is_main_document=1)
    expect(mockManager.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'INSERT IGNORE INTO correspondence_revision_attachments'
      ),
      [500, 101, 1]
    );
    // attachment ที่ 2 และ 3 เป็นเอกสารรอง (is_main_document=0)
    expect(mockManager.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'INSERT IGNORE INTO correspondence_revision_attachments'
      ),
      [500, 102, 0]
    );
    expect(mockManager.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        'INSERT IGNORE INTO correspondence_revision_attachments'
      ),
      [500, 103, 0]
    );
  });

  // ─── 3A.8: Post-migration RAG batch (ระบุชุด) ────────────────────────────

  it('3A.8: triggerRagBatch → enqueue rag-prepare jobs สำหรับ attachments ที่มี OCR text', async () => {
    const mockQueryResult = [
      {
        id: 1,
        public_id: 'att-001',
        ocr_text: 'OCR text content',
        mime_type: 'application/pdf',
        original_filename: 'doc-001.pdf',
        project_public_id: 'proj-001',
      },
    ];
    // RagBatchService ใช้ dataSource.query() โดยตรง (ไม่ใช่ getRepository().query())
    // checkActiveImportBatches เรียกก่อน ส่งคืน [{ active_count: 0 }]
    // fetchRagCandidates เรียกต่อ ส่งคืน candidate rows
    (mockDataSource.query as jest.Mock)
      .mockResolvedValueOnce([{ active_count: 0 }]) // checkActiveImportBatches
      .mockResolvedValueOnce(mockQueryResult); // fetchRagCandidates

    const result = await ragBatchService.triggerRagBatch('RAG-BATCH-INT-001');

    expect(result.total).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(mockAiBatchQueue.add).toHaveBeenCalled();
  });

  // ─── 3A.9: Temp file auto-cleanup 24h หลัง job failed ──────────────────────

  it('3A.9: CleanExpiredStashesWorker → ลบ stash dir ที่หมดอายุ (modified > 24h)', async () => {
    const expiredDir = path.join(tempTestDir, 'expired-session');
    fs.mkdirSync(expiredDir, { recursive: true });
    fs.writeFileSync(path.join(expiredDir, 'test.txt'), 'content');

    const stashService = {
      listExpiredStashDirs: jest.fn().mockResolvedValue([expiredDir]),
    };

    const worker = new CleanExpiredStashesWorker(stashService as never);

    await worker.handleExpiredStashCleanup();

    expect(stashService.listExpiredStashDirs).toHaveBeenCalled();
    // fs.rm ลบ directory จริง
    expect(fs.existsSync(expiredDir)).toBe(false);
  });

  // ─── 3A.10: PENDING > 30 วัน auto-expire ──────────────────────────────────

  it('3A.10: ExpirePendingReviewsWorker → PENDING เกิน 30 วัน → REJECTED + EXPIRED', async () => {
    const expiredRecord = {
      id: 400,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    };

    const mockWorkerReviewQueueRepo = {
      find: jest.fn().mockResolvedValue([expiredRecord]),
      save: jest
        .fn()
        .mockImplementation((entity: Record<string, unknown>) =>
          Promise.resolve(entity)
        ),
    };
    const mockWorkerAttachmentRepo = {
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    const mockWorkerUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    const mockNotificationService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const worker = new ExpirePendingReviewsWorker(
      mockWorkerReviewQueueRepo as never,
      mockWorkerAttachmentRepo as never,
      mockWorkerUserRepo as never,
      mockNotificationService as never
    );

    await worker.handleExpiration();

    expect(mockWorkerReviewQueueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MigrationReviewStatus.REJECTED,
        remarks: 'EXPIRED',
        reviewedBy: 'SYSTEM_AUTO_EXPIRATION',
      })
    );
  });
});
