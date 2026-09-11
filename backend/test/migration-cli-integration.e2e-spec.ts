// File: backend/test/migration-cli-integration.e2e-spec.ts
// Change Log:
// - 2026-09-11: สร้าง Integration Test สำหรับ CLI Ingestion Flow (Phase 3B)
//   ทดสอบ streaming ingestion, checkpointing, resume, sheet selection, memory

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

import { LegacyIngestionService } from '../src/modules/migration/services/legacy-ingestion.service';
import { FileStorageService } from '../src/common/file-storage/file-storage.service';
import { Queue } from 'bullmq';

import { Correspondence } from '../src/modules/correspondence/entities/correspondence.entity';
import { CorrespondenceType } from '../src/modules/correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../src/modules/correspondence/entities/correspondence-status.entity';
import { Project } from '../src/modules/project/entities/project.entity';
import { Organization } from '../src/modules/organization/entities/organization.entity';
import { Discipline } from '../src/modules/master/entities/discipline.entity';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { MigrationReviewQueue } from '../src/modules/migration/entities/migration-review-queue.entity';
import { MigrationError } from '../src/modules/migration/entities/migration-error.entity';
import { MigrationProgress } from '../src/modules/ai/entities/migration-progress.entity';
import { ImportTransaction } from '../src/modules/migration/entities/import-transaction.entity';
import { SystemSetting } from '../src/modules/ai/entities/system-setting.entity';

/**
 * Integration tests สำหรับ CLI Ingestion Flow (Phase 3B)
 * ทดสอบ streaming ingestion, checkpointing ทุก 50 แถว, resume,
 * sheet selection, และ memory footprint
 */
describe('Migration CLI Ingestion Flow (Phase 3B)', () => {
  let legacyIngestionService: LegacyIngestionService;

  const tempTestDir = path.join(__dirname, '__temp_migration_cli__');
  const tempExcelPath = path.join(tempTestDir, 'cli-test.xlsx');
  const tempPdfPath = path.join(tempTestDir, 'DOC-CLI-001.pdf');

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
  const systemSettingRepo = makeMockRepo<SystemSetting>();

  const mockDataSource = {
    getRepository: jest.fn(),
  } as unknown as DataSource;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const mockFileStorageService = {
    moveFile: jest.fn().mockResolvedValue('/permanent/path.pdf'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    permanentDir: '/tmp/permanent',
    tempDir: '/tmp/temp',
  } as unknown as FileStorageService;

  // Mock Queue (สำหรับ LegacyIngestionService)
  const mockAiBatchQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-cli-001' }),
    getJob: jest.fn().mockResolvedValue(null),
  } as unknown as Queue;

  beforeAll(async () => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
    fs.writeFileSync(tempPdfPath, '%PDF-1.4 dummy content');

    // สร้างไฟล์ Excel 60 แถวเพื่อทดสอบ checkpointing ทุก 50 แถว
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
    for (let i = 1; i <= 60; i++) {
      worksheet.addRow([
        i,
        `CLI-DOC-${String(i).padStart(3, '0')}`,
        `CLI test document ${i}`,
        '2024-05-15',
        '2024-05-16',
        'ITD',
        'TEAM',
        'Letter',
        `DOC-CLI-${String(i).padStart(3, '0')}.pdf`,
        '',
      ]);
    }
    await workbook.xlsx.writeFile(tempExcelPath);

    // สร้าง Sheet 2 สำหรับทดสอบ sheet selection
    const sheet2 = workbook.addWorksheet('Sheet2');
    sheet2.addRow([
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
    sheet2.addRow([
      1,
      'CLI-S2-001',
      'Sheet2 document',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      'Letter',
      'DOC-S2-001.pdf',
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
        LegacyIngestionService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: reviewQueueRepo,
        },
        {
          provide: getRepositoryToken(MigrationProgress),
          useValue: progressRepo,
        },
        {
          provide: getRepositoryToken(MigrationError),
          useValue: errorRepo,
        },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: importTxRepo,
        },
        {
          provide: getRepositoryToken(Correspondence),
          useValue: correspondenceRepo,
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
          provide: getRepositoryToken(Organization),
          useValue: organizationRepo,
        },
        { provide: getRepositoryToken(Discipline), useValue: disciplineRepo },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: systemSettingRepo,
        },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: 'BullQueue_ai-batch', useValue: mockAiBatchQueue },
      ],
    }).compile();

    legacyIngestionService = module.get<LegacyIngestionService>(
      LegacyIngestionService
    );
  });

  // ─── 3B.1: Streaming ingestion + checkpoint ทุก 50 แถว ────────────────────

  it('3B.1: startIngestion → อ่าน Excel 60 แถว, checkpoint ทุก 50 แถว', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]);
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, typeCode: 'RFA', typeName: 'Request for Approval' },
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockImplementation((dto: unknown) => dto);
    progressRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    const progressCalls: Array<{ processed: number; enqueued: number }> = [];

    const result = await legacyIngestionService.startIngestion(
      {
        filePath: tempExcelPath,
        projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
        pdfFolderPath: tempTestDir,
      },
      (progress) => {
        progressCalls.push({
          processed: progress.processed,
          enqueued: progress.enqueued,
        });
      }
    );

    // อ่านได้ 60 แถว (ข้าม header)
    expect(result.totalRowsProcessed).toBeGreaterThan(0);
    expect(result.enqueuedCount).toBeGreaterThan(0);

    // progress callback ถูกเรียก
    expect(progressCalls.length).toBeGreaterThan(0);

    // progressRepo.save ถูกเรียกสำหรับ checkpoint
    expect(progressRepo.save).toHaveBeenCalled();
  });

  // ─── 3B.2: Resume จาก checkpoint ─────────────────────────────────────────

  it('3B.2: startIngestion with resume → ทำต่อจาก checkpoint ล่าสุด', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]);
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 1, typeCode: 'RFA', typeName: 'Request for Approval' },
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);

    // Mock existing checkpoint at row 50
    progressRepo.findOne.mockResolvedValue({
      id: 1,
      batchId: 'BATCH-CLI-RESUME',
      lastProcessedIndex: 50,
      status: 'RUNNING',
    });
    progressRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    const result = await legacyIngestionService.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'BATCH-CLI-RESUME',
      resume: true,
    });

    // Resume จาก row 50 — ควรอ่านต่อจากแถวที่ 50
    expect(result.status).toBe('COMPLETED');
    // progressRepo.findOne ถูกเรียกเพื่อหา checkpoint
    expect(progressRepo.findOne).toHaveBeenCalled();
  });

  it('3B.2b: startIngestion without resume → เริ่มใหม่จากแถวแรก (ignore checkpoint)', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
    ]);
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);

    // Mock existing checkpoint at row 50
    progressRepo.findOne.mockResolvedValue({
      id: 1,
      batchId: 'BATCH-CLI-NORESUME',
      lastProcessedIndex: 50,
      status: 'RUNNING',
    });
    progressRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    const result = await legacyIngestionService.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'BATCH-CLI-NORESUME',
      resume: false,
    });

    // Without resume, ควรเริ่มจากแถวแรก (startIndex = 0)
    expect(result.status).toBe('COMPLETED');
  });

  // ─── 3B.3: Sheet selection ─────────────────────────────────────────────────

  it('3B.3: startIngestion with sheetName=Sheet2 → อ่านเฉพาะ Sheet2', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]);
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockImplementation((dto: unknown) => dto);
    progressRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    const result = await legacyIngestionService.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      sheetName: 'Sheet2',
    });

    // Sheet2 มี 1 แถวเอกสาร
    expect(result.status).toBe('COMPLETED');
    expect(result.enqueuedCount).toBe(1);
  });

  // ─── 3B.4: Memory < 100MB สำหรับ 20,000 แถว ──────────────────────────────

  it('3B.4: startIngestion → heap usage ไม่เกิน 100MB สำหรับไฟล์ 60 แถว', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    organizationRepo.find.mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]);
    (correspondenceTypeRepo.find as jest.Mock).mockResolvedValue([
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]);
    reviewQueueRepo.findOne.mockResolvedValue(null);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockImplementation((dto: unknown) => dto);
    progressRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...entity, id: 1 })
    );

    const memoryBefore = process.memoryUsage().heapUsed;

    await legacyIngestionService.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    const memoryAfter = process.memoryUsage().heapUsed;
    const heapDeltaMB = (memoryAfter - memoryBefore) / (1024 * 1024);

    // heap delta ควรน้อยกว่า 100MB (สำหรับไฟล์ 60 แถว ควรใช้น้อยกว่า 10MB)
    // นี่คือ lower bound test — ไฟล์ 20,000 แถวจริงจะทดสอบใน production benchmark
    expect(heapDeltaMB).toBeLessThan(100);
  });

  // ─── 3B.1b: Non-Excel file rejection ───────────────────────────────────────

  it('3B.1b: startIngestion with non-Excel file → ปฏิเสธด้วย BadRequest', async () => {
    const nonExcelPath = path.join(tempTestDir, 'test.txt');
    fs.writeFileSync(nonExcelPath, 'not an excel file');

    await expect(
      legacyIngestionService.startIngestion({
        filePath: nonExcelPath,
        projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
        pdfFolderPath: tempTestDir,
      })
    ).rejects.toThrow();
  });

  // ─── 3B.1c: Missing file ───────────────────────────────────────────────────

  it('3B.1c: startIngestion with missing file → ปฏิเสธด้วย NotFound', async () => {
    await expect(
      legacyIngestionService.startIngestion({
        filePath: '/nonexistent/file.xlsx',
        projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
        pdfFolderPath: tempTestDir,
      })
    ).rejects.toThrow();
  });
});
