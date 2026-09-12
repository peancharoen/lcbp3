// File: backend/tests/performance/excel-data-review.perf-spec.ts
// Change Log:
// - 2026-09-11: Initial creation — Performance benchmark tests สำหรับ
//   Feature 252 Excel Data Review Pipeline (Phase C, SC-001 + SC-002)
//   SC-001: Layer 1+2 200 แถว < 1.5 วินาที (1500ms)
//   SC-002: Annotated Excel ≤200 แถว < 10 วินาที (10000ms)
//   ใช้ real ExcelJS workbook (ไม่ mock) เพื่อวัดเวลาจริงตาม test-plan.md

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { ExcelDataReviewService } from '../../src/modules/migration/services/excel-data-review.service';
import { ExcelRowBuilderService } from '../../src/modules/migration/services/excel-row-builder.service';
import { ExcelHeaderDetectorService } from '../../src/modules/migration/services/excel-header-detector.service';
import { ExcelSchemaValidatorService } from '../../src/modules/migration/services/excel-schema-validator.service';
import { ExcelBusinessRulesService } from '../../src/modules/migration/services/excel-business-rules.service';
import { ReviewSessionStashService } from '../../src/modules/migration/services/review-session-stash.service';
import { AiReviewProviderFactory } from '../../src/modules/migration/services/ai-review-provider.factory';
import { ExcelAnnotatorService } from '../../src/modules/migration/services/excel-annotator.service';
import { ExcelQuarantineService } from '../../src/modules/migration/services/excel-quarantine.service';
import { ExcelDateParserService } from '../../src/modules/migration/services/excel-date-parser.service';
import { QUEUE_IMPORT_REVIEW } from '../../src/modules/common/constants/queue.constants';
import { ImportTransaction } from '../../src/modules/migration/entities/import-transaction.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { CorrespondenceType } from '../../src/modules/correspondence/entities/correspondence-type.entity';
import { Discipline } from '../../src/modules/master/entities/discipline.entity';
import { Correspondence } from '../../src/modules/correspondence/entities/correspondence.entity';
import type {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewSummaryCounts,
} from '../../src/modules/migration/types/excel-review.types';

// ---------- helpers ----------

/**
 * สร้าง real .xlsx workbook ที่มี N แถว พร้อม header ตาม schema
 * ใช้ ExcelJS เขียนไฟล์จริง เพื่อวัดเวลา parse + validate จริง
 */
async function createTestWorkbook(
  rowCount: number,
  filePath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');

  // Header row (ตาม schema ที่ ExcelRowBuilder คาดหวัง)
  sheet.addRow([
    'เลขที่เอกสาร',
    'หัวเรื่อง',
    'ประเภท',
    'สาขาวิชา',
    'เลข Revision',
    'วันที่ออก',
    'วันที่รับ',
    'จาก',
    'ถึง',
    'ชื่อไฟล์',
    'หมายเหตุ',
  ]);

  // Data rows
  for (let i = 1; i <= rowCount; i++) {
    sheet.addRow([
      `DOC-${String(i).padStart(4, '0')}`,
      `เอกสารทดสอบฉบับที่ ${i}`,
      'LTR',
      'CIV',
      '0',
      '2026-01-15',
      '2026-01-16',
      'สำนักงานภูมิภาค',
      'สำนักงานกลาง',
      `doc-${String(i).padStart(4, '0')}.pdf`,
      '',
    ]);
  }

  await workbook.xlsx.writeFile(filePath);
}

/**
 * สร้าง mock Redis client (in-memory)
 */
function createMockRedis() {
  const store = new Map<string, string>();
  return {
    set: jest.fn((key: string, val: string) => {
      store.set(key, val);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    exists: jest.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    expire: jest.fn(() => Promise.resolve(1)),
    ttl: jest.fn(() => Promise.resolve(3600)),
    ping: jest.fn(() => Promise.resolve('PONG')),
  };
}

/**
 * สร้าง mock rows สำหรับ SC-002 (annotator benchmark)
 */
function makeRows(count: number): ExcelCorrespondenceRow[] {
  const rows: ExcelCorrespondenceRow[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      rowIndex: i + 1, // 1-based หลัง header
      documentNumber: `DOC-${String(i).padStart(4, '0')}`,
      subject: `เอกสารทดสอบฉบับที่ ${i}`,
      correspondenceTypeCode: 'LTR',
      disciplineCode: 'CIV',
      revisionNumber: '0',
      issuedDate: new Date('2026-01-15'),
      receivedDate: new Date('2026-01-16'),
      senderOrgRaw: 'สำนักงานภูมิภาค',
      receiverOrgRaw: 'สำนักงานกลาง',
      fileName: `doc-${String(i).padStart(4, '0')}.pdf`,
      remarks: '',
      findings: [],
    });
  }
  return rows;
}

/**
 * สร้าง mock findings สำหรับ SC-002 (มี findings เพื่อทดสอบสีไฮไลต์)
 */
function makeFindings(count: number): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  for (let i = 1; i <= Math.min(count, 20); i++) {
    findings.push({
      row: i + 1,
      column: 'C',
      level: 'WARN',
      message: `คำเตือนที่ ${i}`,
      originalValue: 'unknown',
      suggestedValue: 'LTR',
    });
  }
  return findings;
}

// ---------- SC-001: Layer 1+2 Performance ----------

describe('SC-001: Layer 1+2 Performance (Feature 252)', () => {
  let service: ExcelDataReviewService;
  let tmpDir: string;
  let stagingRoot: string;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    jest.setTimeout(30000);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-sc001-'));
    stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-stash-'));
    mockRedis = createMockRedis();

    const mockAiFactory = {
      review: jest.fn().mockResolvedValue({
        findings: [],
        aiAvailable: false,
        aiUnavailableReason: 'AI disabled in benchmark',
      }),
    };

    const mockQuarantine = {
      prepareQuarantine: jest.fn().mockResolvedValue({
        passedCount: 0,
        quarantinedCount: 0,
        passedRows: [],
        quarantinedRows: [],
        failedRowsFilePath: '',
        batchId: 'perf-batch',
      }),
      enqueuePassedRows: jest.fn().mockResolvedValue([]),
      quarantineFailedRows: jest.fn().mockResolvedValue([]),
      splitRows: jest.fn(),
      generateFailedRowsExcel: jest.fn(),
    };

    const dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (txMgr: unknown) => Promise<unknown>) => {
          const txMgr = {
            getRepository: jest.fn().mockReturnValue({
              save: jest.fn().mockResolvedValue([]),
            }),
          };
          return Promise.resolve(cb(txMgr));
        }),
    } as unknown as jest.Mocked<Pick<DataSource, 'transaction'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExcelDataReviewService,
        ExcelRowBuilderService,
        ExcelHeaderDetectorService,
        ExcelSchemaValidatorService,
        ExcelBusinessRulesService,
        ExcelDateParserService,
        ReviewSessionStashService,
        { provide: AiReviewProviderFactory, useValue: mockAiFactory },
        {
          provide: ExcelAnnotatorService,
          useValue: { generateAnnotated: jest.fn() },
        },
        { provide: ExcelQuarantineService, useValue: mockQuarantine },
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              publicId: '019505a1-7c3e-7000-8000-perf-proj-001',
            }),
          },
        },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: { save: jest.fn().mockResolvedValue({ id: 1 }) },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Discipline),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Correspondence),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: getQueueToken(QUEUE_IMPORT_REVIEW),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
        { provide: 'REVIEW_STAGING_ROOT', useValue: stagingRoot },
      ],
    }).compile();

    service = module.get(ExcelDataReviewService);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  });

  it('C.1.1: 200 แถว → check() + processCheck() เสร็จภายใน 1500ms', async () => {
    const filePath = path.join(tmpDir, 'test-200-rows.xlsx');
    await createTestWorkbook(200, filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const start = Date.now();
    const checkResult = await service.check({
      projectPublicId: '019505a1-7c3e-7000-8000-perf-proj-001',
      targetMode: 'DIRECT_IMPORT',
      aiProvider: 'LOCAL_OLLAMA',
      batchStrategy: 'FULL',
      uploadedBy: '019505a1-7c3e-7000-8000-perf-user-01',
      file: {
        originalname: 'test-200-rows.xlsx',
        buffer: fileBuffer,
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: fileBuffer.length,
      },
    });
    await service.processCheck(checkResult.reviewSessionPublicId);
    const elapsed = Date.now() - start;

    const status = await service.getStatus(checkResult.reviewSessionPublicId);
    expect(status.result?.totalRows).toBe(200);
    expect(elapsed).toBeLessThan(1500);
  });

  it('C.1.2: 50 แถว → check() + processCheck() เสร็จภายใน 500ms (sanity check)', async () => {
    const filePath = path.join(tmpDir, 'test-50-rows.xlsx');
    await createTestWorkbook(50, filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const start = Date.now();
    const checkResult = await service.check({
      projectPublicId: '019505a1-7c3e-7000-8000-perf-proj-001',
      targetMode: 'DIRECT_IMPORT',
      aiProvider: 'LOCAL_OLLAMA',
      batchStrategy: 'FULL',
      uploadedBy: '019505a1-7c3e-7000-8000-perf-user-01',
      file: {
        originalname: 'test-50-rows.xlsx',
        buffer: fileBuffer,
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: fileBuffer.length,
      },
    });
    await service.processCheck(checkResult.reviewSessionPublicId);
    const elapsed = Date.now() - start;

    const status = await service.getStatus(checkResult.reviewSessionPublicId);
    expect(status.result?.totalRows).toBe(50);
    expect(elapsed).toBeLessThan(500);
  });
});

// ---------- SC-002: Annotated Excel Performance ----------

describe('SC-002: Annotated Excel Performance (Feature 252)', () => {
  let annotator: ExcelAnnotatorService;
  let tmpDir: string;

  beforeEach(async () => {
    jest.setTimeout(30000);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-sc002-'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelAnnotatorService],
    }).compile();

    annotator = module.get(ExcelAnnotatorService);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('C.2.1: สร้าง annotated Excel 200 แถว (มี findings) เสร็จภายใน 10000ms', async () => {
    const rows = makeRows(200);
    const findings = makeFindings(200);
    const counts: ReviewSummaryCounts = {
      totalRows: 200,
      passCount: 180,
      warnCount: 15,
      blockCount: 5,
      aiSuggestCount: 0,
      canConfirm: false,
    };

    // สร้าง original file (dummy — annotator ไม่ได้อ่านมัน)
    const originalPath = path.join(tmpDir, 'original.xlsx');
    fs.writeFileSync(originalPath, Buffer.from('fake'));
    const outputPath = path.join(tmpDir, 'annotated.xlsx');

    const start = Date.now();
    await annotator.generateAnnotated({
      originalFilePath: originalPath,
      rows,
      counts,
      findings,
      outputPath,
    });
    const elapsed = Date.now() - start;

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(elapsed).toBeLessThan(10000);
  });

  it('C.2.2: สร้าง annotated Excel 100 แถว (ไม่มี findings) เสร็จภายใน 5000ms (sanity)', async () => {
    const rows = makeRows(100);
    const counts: ReviewSummaryCounts = {
      totalRows: 100,
      passCount: 100,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      canConfirm: true,
    };

    const originalPath = path.join(tmpDir, 'original.xlsx');
    fs.writeFileSync(originalPath, Buffer.from('fake'));
    const outputPath = path.join(tmpDir, 'annotated.xlsx');

    const start = Date.now();
    await annotator.generateAnnotated({
      originalFilePath: originalPath,
      rows,
      counts,
      findings: [],
      outputPath,
    });
    const elapsed = Date.now() - start;

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });
});
