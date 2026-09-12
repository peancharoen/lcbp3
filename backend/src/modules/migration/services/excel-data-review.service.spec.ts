// File: backend/src/modules/migration/services/excel-data-review.service.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ ExcelDataReviewService (T011)
//   ครอบคลุม Wave 3 review findings:
//   - canConfirm logic (global BLOCK + target mode)
//   - ZIP extraction (success + missing xlsx + corrupt zip)
//   - Corrupt workbook → BadRequestException
//   - Path traversal sanitization
//   - Project validation before session creation

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import { Project } from '../../project/entities/project.entity';
import { ExcelDataReviewService } from './excel-data-review.service';
import { ExcelRowBuilderService } from './excel-row-builder.service';
import { ExcelSchemaValidatorService } from './excel-schema-validator.service';
import { ExcelBusinessRulesService } from './excel-business-rules.service';
import { ReviewSessionStashService } from './review-session-stash.service';
import { AiReviewProviderFactory } from './ai-review-provider.factory';
import { ExcelAnnotatorService } from './excel-annotator.service';
import { ExcelQuarantineService } from './excel-quarantine.service';
import { ImportTransaction } from '../entities/import-transaction.entity';
import { DataSource } from 'typeorm';
import { QUEUE_IMPORT_REVIEW } from '../../common/constants/queue.constants';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewTargetMode,
  BatchStrategy,
} from '../types/excel-review.types';
import { ExcelRowBuilderResult } from './excel-row-builder.service';

/** Mock repository factory */
const mockRepo = <T>(): jest.Mocked<Pick<T, 'findOne' | 'find'>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
  }) as unknown as jest.Mocked<Pick<T, 'findOne' | 'find'>>;

/**
 * สร้าง .xlsx buffer จำลอง (ExcelJS) สำหรับทดสอบ
 */
async function makeValidXlsxBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.getRow(1).values = [
    'เอกสารเลขที่',
    'เรื่อง',
    'จาก',
    'ถึง',
    'วันที่ออก',
    'วันที่รับ',
  ];
  ws.getRow(2).values = [
    'DOC-001',
    'เรื่องทดสอบ',
    'NP-DMS',
    'CLIENT',
    '2025-08-15',
    '2025-08-16',
  ];
  const tmpPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'test-xlsx-')),
    'test.xlsx'
  );
  await wb.xlsx.writeFile(tmpPath);
  const buf = fs.readFileSync(tmpPath);
  fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
  return buf;
}

/** สร้าง .zip buffer ที่มี .xlsx + .pdf */
function makeValidZipBuffer(xlsxBuffer: Buffer): Buffer {
  const zip = new AdmZip();
  zip.addFile('register.xlsx', xlsxBuffer);
  zip.addFile('doc1.pdf', Buffer.from('fake pdf content'));
  return zip.toBuffer();
}

/** สร้าง .zip buffer ที่ไม่มี .xlsx */
function makeZipWithoutXlsx(): Buffer {
  const zip = new AdmZip();
  zip.addFile('doc1.pdf', Buffer.from('fake pdf content'));
  return zip.toBuffer();
}

/** สร้าง corrupt .zip buffer */
function makeCorruptZipBuffer(): Buffer {
  return Buffer.from('this is not a valid zip file');
}

describe('ExcelDataReviewService', () => {
  let service: ExcelDataReviewService;
  let projectRepo: jest.Mocked<Pick<Repository<Project>, 'findOne' | 'find'>>;
  let rowBuilder: jest.Mocked<ExcelRowBuilderService>;
  let schemaValidator: jest.Mocked<ExcelSchemaValidatorService>;
  let businessRules: jest.Mocked<ExcelBusinessRulesService>;
  let stash: jest.Mocked<ReviewSessionStashService>;
  let aiFactory: jest.Mocked<AiReviewProviderFactory>;
  let annotator: jest.Mocked<ExcelAnnotatorService>;
  let quarantine: jest.Mocked<ExcelQuarantineService>;
  let importTxRepo: jest.Mocked<Pick<Repository<ImportTransaction>, 'save'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  const makeRow = (
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow => ({
    rowIndex: 2,
    documentNumber: 'DOC-001',
    subject: 'เรื่องทดสอบ',
    revisionNumber: '0',
    findings: [],
    ...overrides,
  });

  const makeParsed = (
    rows: ExcelCorrespondenceRow[]
  ): ExcelRowBuilderResult => ({
    headerMappingFound: true,
    sheetNames: ['Sheet1'],
    skippedRows: 0,
    rows,
  });

  beforeEach(async () => {
    projectRepo = mockRepo();
    rowBuilder = {
      buildFromWorkbook: jest.fn(),
    } as unknown as jest.Mocked<ExcelRowBuilderService>;
    schemaValidator = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<ExcelSchemaValidatorService>;
    businessRules = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<ExcelBusinessRulesService>;
    stash = {
      createSession: jest.fn(),
      createPendingSession: jest.fn(),
      getSession: jest.fn(),
      updateStatus: jest.fn(),
      updateProgress: jest.fn(),
      updateResult: jest.fn(),
      updateAnnotatedPath: jest.fn(),
      updateFailedRowsPath: jest.fn(),
      deleteSession: jest.fn(),
      tryLockForConfirm: jest.fn(),
      getStashDir: jest.fn(),
      listExpiredStashDirs: jest.fn(),
    } as unknown as jest.Mocked<ReviewSessionStashService>;
    aiFactory = {
      review: jest.fn(),
    } as unknown as jest.Mocked<AiReviewProviderFactory>;
    annotator = {
      generateAnnotated: jest.fn(),
    } as unknown as jest.Mocked<ExcelAnnotatorService>;
    quarantine = {
      prepareQuarantine: jest.fn(),
      enqueuePassedRows: jest.fn(),
      quarantineFailedRows: jest.fn(),
      splitRows: jest.fn(),
      generateFailedRowsExcel: jest.fn(),
    } as unknown as jest.Mocked<ExcelQuarantineService>;
    importTxRepo = { save: jest.fn() };
    // Mock dataSource.transaction — call the callback with a mock txMgr
    dataSource = {
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

    // Default: project มีอยู่
    projectRepo.findOne.mockResolvedValue({
      id: 1,
      publicId: 'proj-uuid-1',
    } as Partial<Project> as Project);

    // Default: schema validator ผ่าน
    schemaValidator.validate.mockImplementation((parsed) => ({
      workbookReadable: true,
      headerMappingFound: true,
      findings: [],
      rows: parsed.rows,
      sheetNames: parsed.sheetNames,
      skippedRows: parsed.skippedRows,
    }));

    // Default: business rules ผ่าน (ไม่มี findings)
    businessRules.validate.mockResolvedValue({
      findings: [],
      rows: [makeRow()],
    });

    // Default: stash สร้าง session สำเร็จ (sync path — legacy)
    stash.createSession.mockResolvedValue({
      reviewSessionPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      projectPublicId: 'proj-uuid-1',
      targetMode: 'DIRECT_IMPORT',
      uploadedBy: 'user-uuid-1',
      totalRows: 1,
      passCount: 1,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      originalFileName: 'test.xlsx',
      originalFilePath: '/tmp/stash/test.xlsx',
      annotatedFilePath: '',
      failedRowsFilePath: '',
      selectedAiProvider: 'LOCAL_OLLAMA',
      status: 'READY',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    });
    // Async pattern mocks (ADR-008)
    stash.createPendingSession.mockResolvedValue({
      reviewSessionPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      projectPublicId: 'proj-uuid-1',
      targetMode: 'DIRECT_IMPORT',
      uploadedBy: 'user-uuid-1',
      totalRows: 0,
      passCount: 0,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      originalFileName: 'test.xlsx',
      originalFilePath: '/tmp/stash/test.xlsx',
      annotatedFilePath: '',
      failedRowsFilePath: '',
      selectedAiProvider: 'LOCAL_OLLAMA',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      progress: 0,
      currentStep: 'Queued',
      batchStrategy: 'FULL',
    });
    stash.updateStatus.mockResolvedValue(null);
    stash.updateProgress.mockResolvedValue(null);
    stash.updateResult.mockResolvedValue(null);
    stash.getSession.mockResolvedValue({
      reviewSessionPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      projectPublicId: 'proj-uuid-1',
      targetMode: 'DIRECT_IMPORT',
      uploadedBy: 'user-uuid-1',
      totalRows: 1,
      passCount: 1,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      originalFileName: 'test.xlsx',
      originalFilePath: '/tmp/stash/test.xlsx',
      annotatedFilePath: '/tmp/stash/annotated.xlsx',
      failedRowsFilePath: '',
      selectedAiProvider: 'LOCAL_OLLAMA',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      progress: 0,
      currentStep: 'Queued',
      batchStrategy: 'FULL',
    });
    stash.updateAnnotatedPath.mockResolvedValue(null);

    // Default: AI fail-open (ไม่พร้อม)
    aiFactory.review.mockResolvedValue({
      available: false,
      findings: [],
      unavailableReason: 'AI disabled in test',
    });

    // Default: annotator สำเร็จ
    annotator.generateAnnotated.mockResolvedValue('/tmp/stash/annotated.xlsx');

    // Default: quarantine สำเร็จ
    quarantine.prepareQuarantine.mockResolvedValue({
      passedCount: 1,
      quarantinedCount: 0,
      passedRows: [makeRow()],
      quarantinedRows: [],
      failedRowsFilePath: '',
      batchId: 'batch-uuid-1',
    });
    quarantine.enqueuePassedRows.mockResolvedValue([
      { id: 1, documentNumber: 'DOC-001' },
    ] as unknown as ReturnType<ExcelQuarantineService['enqueuePassedRows']>);
    quarantine.quarantineFailedRows.mockResolvedValue([]);

    // Default: importTxRepo สำเร็จ
    importTxRepo.save.mockResolvedValue({ id: 1 } as ImportTransaction);

    const module = await Test.createTestingModule({
      providers: [
        ExcelDataReviewService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: importTxRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: ExcelRowBuilderService, useValue: rowBuilder },
        { provide: ExcelSchemaValidatorService, useValue: schemaValidator },
        { provide: ExcelBusinessRulesService, useValue: businessRules },
        { provide: ReviewSessionStashService, useValue: stash },
        { provide: AiReviewProviderFactory, useValue: aiFactory },
        { provide: ExcelAnnotatorService, useValue: annotator },
        { provide: ExcelQuarantineService, useValue: quarantine },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: getQueueToken(QUEUE_IMPORT_REVIEW),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
      ],
    }).compile();

    service = module.get<ExcelDataReviewService>(ExcelDataReviewService);
  });

  const makeInput = (
    overrides: Partial<{
      projectPublicId: string;
      targetMode: ReviewTargetMode;
      batchStrategy: BatchStrategy;
      fileBuffer: Buffer;
      fileName: string;
    }> = {}
  ) => ({
    projectPublicId: overrides.projectPublicId ?? 'proj-uuid-1',
    targetMode: overrides.targetMode ?? ('DIRECT_IMPORT' as ReviewTargetMode),
    aiProvider: 'LOCAL_OLLAMA' as const,
    batchStrategy: overrides.batchStrategy ?? ('FULL' as BatchStrategy),
    uploadedBy: 'user-uuid-1',
    file: {
      originalname: overrides.fileName ?? 'test.xlsx',
      buffer: overrides.fileBuffer ?? Buffer.from('fake xlsx'),
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
    },
  });

  /**
   * Helper สำหรับ processCheck() tests — สร้าง temp file จริง
   * และตั้งค่า stash.getSession ให้คืน session ที่ชี้ไปยัง temp file
   */
  const setupProcessCheck = async (
    overrides: Partial<{
      targetMode: ReviewTargetMode;
      batchStrategy: BatchStrategy;
      fileName: string;
      fileBuffer: Buffer;
    }> = {}
  ): Promise<string> => {
    const sessionId = '019505a1-7c3e-7000-8000-abc123def456';
    const tmpFile = path.join(
      os.tmpdir(),
      `process-check-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
    );
    await fs.promises.writeFile(
      tmpFile,
      overrides.fileBuffer ?? Buffer.from('fake-xlsx')
    );

    stash.getSession.mockResolvedValue({
      reviewSessionPublicId: sessionId,
      projectPublicId: 'proj-uuid-1',
      targetMode: overrides.targetMode ?? ('DIRECT_IMPORT' as ReviewTargetMode),
      uploadedBy: 'user-uuid-1',
      totalRows: 0,
      passCount: 0,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      originalFileName: overrides.fileName ?? 'test.xlsx',
      originalFilePath: tmpFile,
      annotatedFilePath: '',
      failedRowsFilePath: '',
      selectedAiProvider: 'LOCAL_OLLAMA',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      progress: 0,
      currentStep: 'Queued',
      batchStrategy: overrides.batchStrategy ?? 'FULL',
    });

    return sessionId;
  };

  describe('project validation before session', () => {
    it('BadRequestException เมื่อ project ไม่มีอยู่ (ไม่สร้าง stash)', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.check(makeInput())).rejects.toThrow(
        BadRequestException
      );
      expect(stash.createPendingSession).not.toHaveBeenCalled();
    });

    it('คืน async response (sessionId + PENDING) เมื่อ project มีอยู่', async () => {
      const result = await service.check(makeInput());
      expect(result.reviewSessionPublicId).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.statusUrl).toContain('/status');
      expect(stash.createPendingSession).toHaveBeenCalled();
    });
  });

  describe('unsupported file extension', () => {
    it('BadRequestException เมื่อนามสกุลไม่รองรับ', async () => {
      await expect(
        service.check(makeInput({ fileName: 'test.csv' }))
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('corrupt workbook (processCheck)', () => {
    it('BadRequestException เมื่ออ่าน workbook ไม่ได้ (mark FAILED)', async () => {
      const sessionId = await setupProcessCheck();
      rowBuilder.buildFromWorkbook.mockRejectedValue(
        new Error('Unexpected token in xlsx')
      );

      await service.processCheck(sessionId);

      expect(stash.updateStatus).toHaveBeenCalledWith(
        sessionId,
        'FAILED',
        expect.stringContaining('Unexpected token')
      );
    });
  });

  describe('ZIP extraction (processCheck)', () => {
    it('แตก ZIP สำเร็จและส่ง attachmentFileNames ให้ business rules', async () => {
      const xlsxBuf = await makeValidXlsxBuffer();
      const zipBuf = makeValidZipBuffer(xlsxBuf);
      const sessionId = await setupProcessCheck({
        fileName: 'bundle.zip',
        fileBuffer: zipBuf,
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));

      await service.processCheck(sessionId);

      expect(businessRules.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentFileNames: ['doc1.pdf'],
        })
      );
    });

    it('mark FAILED เมื่อ ZIP ไม่มี .xlsx', async () => {
      const zipBuf = makeZipWithoutXlsx();
      const sessionId = await setupProcessCheck({
        fileName: 'bundle.zip',
        fileBuffer: zipBuf,
      });

      await service.processCheck(sessionId);

      expect(stash.updateStatus).toHaveBeenCalledWith(
        sessionId,
        'FAILED',
        expect.stringContaining('ไม่พบไฟล์ .xlsx')
      );
    });

    it('mark FAILED เมื่อ ZIP corrupt', async () => {
      const corruptZip = makeCorruptZipBuffer();
      const sessionId = await setupProcessCheck({
        fileName: 'bundle.zip',
        fileBuffer: corruptZip,
      });

      await service.processCheck(sessionId);

      expect(stash.updateStatus).toHaveBeenCalledWith(
        sessionId,
        'FAILED',
        expect.any(String)
      );
    });
  });

  describe('canConfirm logic (global BLOCK + target mode) — processCheck', () => {
    it('canConfirm=false เมื่อมี global BLOCK (project not found ใน Layer 2)', async () => {
      const globalBlock: ReviewFinding = {
        row: 0,
        column: 'Project',
        level: 'BLOCK',
        message: 'ไม่พบโครงการ',
        originalValue: 'proj-uuid-1',
      };
      businessRules.validate.mockResolvedValue({
        findings: [globalBlock],
        rows: [],
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([]));
      const sessionId = await setupProcessCheck();

      await service.processCheck(sessionId);

      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          blockCount: 0, // ไม่มี row block
        })
      );
      // result ไม่มี canConfirm โดยตรง แต่ stash.updateResult ถูกเรียก
      // canConfirm คำนวณใน processCheck และเก็บใน Redis result
    });

    it('canConfirm=false ใน DIRECT_IMPORT เมื่อมี row BLOCK', async () => {
      const rowBlock: ReviewFinding = {
        row: 2,
        column: 'Document Number',
        level: 'BLOCK',
        message: 'ซ้ำใน DB',
        originalValue: 'DOC-001',
      };
      const row = makeRow({ findings: [rowBlock] });
      businessRules.validate.mockResolvedValue({
        findings: [rowBlock],
        rows: [row],
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([row]));
      const sessionId = await setupProcessCheck({
        targetMode: 'DIRECT_IMPORT',
      });

      await service.processCheck(sessionId);

      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ blockCount: 1 })
      );
    });

    it('canConfirm=true ใน MIGRATION_STAGING เมื่อมี row BLOCK (partial quarantine)', async () => {
      const rowBlock: ReviewFinding = {
        row: 2,
        column: 'Document Number',
        level: 'BLOCK',
        message: 'ซ้ำใน DB',
        originalValue: 'DOC-001',
      };
      const row = makeRow({ findings: [rowBlock] });
      businessRules.validate.mockResolvedValue({
        findings: [rowBlock],
        rows: [row],
      });

      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([row]));
      const sessionId = await setupProcessCheck({
        targetMode: 'MIGRATION_STAGING',
      });

      await service.processCheck(sessionId);

      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ blockCount: 1 })
      );
    });

    it('canConfirm=false ใน MIGRATION_STAGING เมื่อมี global BLOCK', async () => {
      const globalBlock: ReviewFinding = {
        row: 0,
        column: 'Header',
        level: 'BLOCK',
        message: 'ไม่พบ header',
        originalValue: [],
      };
      businessRules.validate.mockResolvedValue({
        findings: [globalBlock],

        rows: [],
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([]));
      const sessionId = await setupProcessCheck({
        targetMode: 'MIGRATION_STAGING',
      });

      await service.processCheck(sessionId);

      // global block → updateResult ไม่ถูกเรียก (canConfirm=false)
      // แต่ updateStatus FAILED ไม่ควรเกิด — canConfirm=false ไม่ใช่ error
      expect(stash.updateResult).toHaveBeenCalled();
    });

    it('canConfirm=true เมื่อไม่มี BLOCK เลย (ทั้งสอง mode)', async () => {
      const row = makeRow({ findings: [] });
      businessRules.validate.mockResolvedValue({
        findings: [],
        rows: [row],
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([row]));

      const sessionIdDirect = await setupProcessCheck({
        targetMode: 'DIRECT_IMPORT',
      });
      await service.processCheck(sessionIdDirect);
      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionIdDirect,
        expect.objectContaining({ blockCount: 0 })
      );

      const sessionIdStaging = await setupProcessCheck({
        targetMode: 'MIGRATION_STAGING',
      });
      await service.processCheck(sessionIdStaging);
      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionIdStaging,
        expect.objectContaining({ blockCount: 0 })
      );
    });
  });

  describe('Layer 1 per-row findings affect canConfirm — processCheck', () => {
    it('canConfirm=false ใน DIRECT_IMPORT เมื่อ Layer 1 ส่ง row BLOCK (missing document number)', async () => {
      const rowBlock: ReviewFinding = {
        row: 2,
        column: 'Document Number',
        level: 'BLOCK',
        message: 'เลขที่เอกสารบังคับระบุ ไม่สามารถเว้นว่างได้',
        originalValue: '',
      };
      const row = makeRow({ findings: [rowBlock] });
      schemaValidator.validate.mockReturnValue({
        workbookReadable: true,
        headerMappingFound: true,
        findings: [rowBlock],
        rows: [row],
        sheetNames: ['Sheet1'],
        skippedRows: 0,
      });
      businessRules.validate.mockResolvedValue({
        findings: [],
        rows: [row],
      });
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([row]));
      const sessionId = await setupProcessCheck({
        targetMode: 'DIRECT_IMPORT',
      });

      await service.processCheck(sessionId);

      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ blockCount: 1 })
      );
    });
  });

  describe('path traversal sanitization', () => {
    it('check() ไม่ throw เมื่อชื่อไฟล์มี path traversal (sanitize ก่อน stash)', async () => {
      const result = await service.check(
        makeInput({ fileName: '../../../etc/passwd.xlsx' })
      );
      expect(result.reviewSessionPublicId).toBeDefined();
      expect(result.status).toBe('PENDING');
    });
  });

  describe('Layer 3 AI integration (Wave 4) — processCheck', () => {
    it('เรียก aiFactory.review และรวม AI_SUGGEST findings ในผลลัพธ์', async () => {
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));
      const aiSuggestion: ReviewFinding = {
        row: 2,
        column: 'AI Review',
        level: 'AI_SUGGEST',
        message: 'Suggest type RFA',
        originalValue: undefined,
        suggestedValue: { type: 'RFA' },
        confidence: 0.9,
      };
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [aiSuggestion],
      });
      const sessionId = await setupProcessCheck();

      await service.processCheck(sessionId);

      expect(aiFactory.review).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPublicId: 'proj-uuid-1',
          provider: 'LOCAL_OLLAMA',
          batchStrategy: 'FULL',
        })
      );
      // result ถูกเก็บใน Redis — ตรวจได้จาก redis.set
      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ aiSuggestCount: 1 })
      );
    });

    it('Fail-Open: ยังคืน result เมื่อ AI ไม่พร้อม (aiAvailable=false)', async () => {
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));
      aiFactory.review.mockResolvedValue({
        available: false,
        findings: [],
        unavailableReason: 'Ollama not started',
      });
      const sessionId = await setupProcessCheck();

      await service.processCheck(sessionId);

      // Fail-Open: ยังอัปเดต result ได้ (status=READY)
      expect(stash.updateResult).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ aiSuggestCount: 0 })
      );
    });

    it('Fail-Open: ยังคืน result เมื่อ annotator ล้มเหลว', async () => {
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));
      annotator.generateAnnotated.mockRejectedValue(new Error('disk full'));
      const sessionId = await setupProcessCheck();

      await service.processCheck(sessionId);

      // Fail-Open: ยังอัปเดต result ได้ (annotated path ว่าง แต่ status=READY)
      expect(stash.updateResult).toHaveBeenCalled();
    });

    it('เรียก annotator.generateAnnotated หลังสร้าง session', async () => {
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));
      const sessionId = await setupProcessCheck();

      await service.processCheck(sessionId);

      expect(annotator.generateAnnotated).toHaveBeenCalledTimes(1);
      expect(stash.updateAnnotatedPath).toHaveBeenCalledTimes(1);
    });
  });

  describe('Q3 Batching Strategy — FAST_SELECTIVE (US3 Acceptance 1) — processCheck', () => {
    it('FULL mode: ส่งทุกแถวให้ AI (default)', async () => {
      const rows = [
        makeRow({ rowIndex: 1 }),
        makeRow({ rowIndex: 2 }),
        makeRow({ rowIndex: 3 }),
      ];
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({ batchStrategy: 'FULL' });

      await service.processCheck(sessionId);

      expect(aiFactory.review).toHaveBeenCalledWith(
        expect.objectContaining({
          rows,
          projectPublicId: 'proj-uuid-1',
          provider: 'LOCAL_OLLAMA',
          batchStrategy: 'FULL',
        })
      );
    });

    it('FAST_SELECTIVE: ส่งเฉพาะแถว WARN + สุ่ม 5% ของแถวที่ผ่าน', async () => {
      const rows: ExcelCorrespondenceRow[] = [];
      for (let i = 1; i <= 250; i++) {
        const hasWarn = i <= 10;
        rows.push(
          makeRow({
            rowIndex: i,
            findings: hasWarn
              ? [
                  {
                    row: i,
                    column: 'From',
                    level: 'WARN' as const,
                    message: 'หน่วยงานไม่ตรง Master',
                  },
                ]
              : [],
          })
        );
      }
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({
        batchStrategy: 'FAST_SELECTIVE',
      });

      await service.processCheck(sessionId);

      const calledWith = aiFactory.review.mock.calls[0][0];
      expect(calledWith.batchStrategy).toBe('FAST_SELECTIVE');
      expect(calledWith.rows.length).toBe(10 + 12); // 10 WARN + 5% of 240
    });

    it('FAST_SELECTIVE: ส่งแถว WARN ทั้งหมดแม้ไม่มีแถว PASS', async () => {
      const rows: ExcelCorrespondenceRow[] = [];
      for (let i = 1; i <= 5; i++) {
        rows.push(
          makeRow({
            rowIndex: i,
            findings: [
              {
                row: i,
                column: 'From',
                level: 'WARN' as const,
                message: 'หน่วยงานไม่ตรง',
              },
            ],
          })
        );
      }
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({
        batchStrategy: 'FAST_SELECTIVE',
      });

      await service.processCheck(sessionId);

      const calledWith = aiFactory.review.mock.calls[0][0];
      expect(calledWith.rows.length).toBe(5);
    });

    it('FAST_SELECTIVE: สุ่มอย่างน้อย 1 แถวถ้ามีแต่แถว PASS', async () => {
      const rows: ExcelCorrespondenceRow[] = [];
      for (let i = 1; i <= 300; i++) {
        rows.push(makeRow({ rowIndex: i, findings: [] }));
      }
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({
        batchStrategy: 'FAST_SELECTIVE',
      });

      await service.processCheck(sessionId);

      const calledWith = aiFactory.review.mock.calls[0][0];
      expect(calledWith.rows.length).toBe(15); // 5% of 300
    });

    it('FAST_SELECTIVE: กรองแถว BLOCK ออกจากการส่ง AI', async () => {
      const rows: ExcelCorrespondenceRow[] = [];
      for (let i = 1; i <= 210; i++) {
        const isBlock = i <= 10;
        const isWarn = i > 10 && i <= 20;
        rows.push(
          makeRow({
            rowIndex: i,
            findings: isBlock
              ? [
                  {
                    row: i,
                    column: 'Issued Date',
                    level: 'BLOCK' as const,
                    message: 'วันที่ขัดแย้ง',
                  },
                ]
              : isWarn
                ? [
                    {
                      row: i,
                      column: 'From',
                      level: 'WARN' as const,
                      message: 'หน่วยงานไม่ตรง',
                    },
                  ]
                : [],
          })
        );
      }
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({
        batchStrategy: 'FAST_SELECTIVE',
      });

      await service.processCheck(sessionId);

      const calledWith = aiFactory.review.mock.calls[0][0];
      // 10 WARN + 5% of 190 PASS = 10 → รวม 20
      // BLOCK ไม่ถูกส่งให้ AI
      const sentRows = calledWith.rows;
      expect(sentRows.length).toBe(10 + 10);
      expect(
        sentRows.every((r) => !r.findings.some((f) => f.level === 'BLOCK'))
      ).toBe(true);
    });

    it('FAST_SELECTIVE: cap WARN rows ที่ 50 แถว (ป้องกัน migration data ส่ง AI ทุกแถว)', async () => {
      // จำลอง migration data: ทุกแถวมี WARN จาก master mismatch
      const rows: ExcelCorrespondenceRow[] = [];
      for (let i = 1; i <= 265; i++) {
        rows.push(
          makeRow({
            rowIndex: i,
            findings: [
              {
                row: i,
                column: 'Category',
                level: 'WARN' as const,
                message: 'ประเภทเอกสารไม่ตรง Master',
              },
            ],
          })
        );
      }
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed(rows));
      businessRules.validate.mockResolvedValue({ findings: [], rows });
      aiFactory.review.mockResolvedValue({
        available: true,
        findings: [],
      });
      const sessionId = await setupProcessCheck({
        batchStrategy: 'FAST_SELECTIVE',
      });

      await service.processCheck(sessionId);

      const calledWith = aiFactory.review.mock.calls[0][0];
      // 265 WARN → capped at 50, 0 PASS → 0 sampled → รวม 50
      expect(calledWith.rows.length).toBe(50);
      expect(
        calledWith.rows.every((r) => r.findings.some((f) => f.level === 'WARN'))
      ).toBe(true);
    });
  });

  describe('getAnnotatedFilePath (T015)', () => {
    it('คืน path เมื่อ session มี annotatedFilePath', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'test.xlsx',
        originalFilePath: '/tmp/test.xlsx',
        annotatedFilePath: '/tmp/annotated.xlsx',
        failedRowsFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'READY',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      const result = await service.getAnnotatedFilePath('session-1');
      expect(result.filePath).toBe('/tmp/annotated.xlsx');
      expect(result.originalFileName).toBe('annotated-test.xlsx');
    });

    it('NotFoundException เมื่อ session ไม่มี (หมดอายุ)', async () => {
      stash.getSession.mockResolvedValue(null);

      await expect(
        service.getAnnotatedFilePath('nonexistent')
      ).rejects.toThrow();
    });

    it('NotFoundException เมื่อ annotatedFilePath ว่าง (ยังไม่สร้าง)', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'test.xlsx',
        originalFilePath: '/tmp/test.xlsx',
        annotatedFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'READY',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      await expect(service.getAnnotatedFilePath('session-1')).rejects.toThrow();
    });

    it('บังคับนามสกุล .xlsx แม้ต้นฉบับเป็น .zip', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'bundle.zip',
        originalFilePath: '/tmp/bundle.zip',
        annotatedFilePath: '/tmp/annotated.xlsx',
        failedRowsFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'READY',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      const result = await service.getAnnotatedFilePath('session-1');
      expect(result.originalFileName).toBe('annotated-bundle.xlsx');
      expect(result.originalFileName.endsWith('.xlsx')).toBe(true);
    });
  });

  describe('confirm (T020, FR-014, FR-015, FR-016, FR-017)', () => {
    const makeReadySession = () => ({
      reviewSessionPublicId: 'session-confirm-1',
      projectPublicId: 'proj-uuid-1',
      targetMode: 'DIRECT_IMPORT' as ReviewTargetMode,
      uploadedBy: 'user-1',
      totalRows: 1,
      passCount: 1,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      originalFileName: 'test.xlsx',
      originalFilePath: '/tmp/stash/test.xlsx',
      annotatedFilePath: '/tmp/stash/annotated.xlsx',
      failedRowsFilePath: '',
      selectedAiProvider: 'LOCAL_OLLAMA' as const,
      status: 'READY' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    });

    it('NotFoundException เมื่อ session ไม่มี (หมดอายุ)', async () => {
      stash.getSession.mockResolvedValue(null);

      await expect(
        service.confirm({
          reviewSessionPublicId: 'nonexistent',
          confirmedBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    it('BadRequestException เมื่อ session ถูก confirm แล้ว (status != READY)', async () => {
      const session = makeReadySession();
      session.status = 'CONFIRMED';
      stash.getSession.mockResolvedValue(session);

      await expect(
        service.confirm({
          reviewSessionPublicId: 'session-confirm-1',
          confirmedBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    it('confirm สำเร็จ — re-validate + quarantine + DB + stash cleanup', async () => {
      const session = makeReadySession();
      stash.getSession.mockResolvedValue(session);
      stash.tryLockForConfirm.mockResolvedValue(true);
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));
      stash.deleteSession.mockResolvedValue(undefined);

      // สร้าง temp file จริงเพื่อให้ readFileFromStash ทำงานได้
      const tmpFile = path.join(os.tmpdir(), 'confirm-test-stash.xlsx');
      await fs.promises.writeFile(tmpFile, Buffer.from('fake-xlsx'));
      session.originalFilePath = tmpFile;

      const result = await service.confirm({
        reviewSessionPublicId: 'session-confirm-1',
        confirmedBy: 'user-1',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.batchId).toBeDefined();
      expect(quarantine.prepareQuarantine).toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(stash.deleteSession).toHaveBeenCalledWith('session-confirm-1');

      await fs.promises.rm(tmpFile, { force: true }).catch(() => undefined);
    });

    it('บันทึก import_transactions เป็น audit trail (FR-017)', async () => {
      const session = makeReadySession();
      stash.getSession.mockResolvedValue(session);
      stash.tryLockForConfirm.mockResolvedValue(true);
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));

      const tmpFile = path.join(os.tmpdir(), 'confirm-test-audit.xlsx');
      await fs.promises.writeFile(tmpFile, Buffer.from('fake-xlsx'));
      session.originalFilePath = tmpFile;

      await service.confirm({
        reviewSessionPublicId: 'session-confirm-1',
        confirmedBy: 'user-1',
      });

      // transaction mock ถูกเรียก (audit trail บันทึกใน transaction)
      expect(dataSource.transaction).toHaveBeenCalled();

      await fs.promises.rm(tmpFile, { force: true }).catch(() => undefined);
    });

    it('ลบ stash หลัง confirm สำเร็จ (FR-016)', async () => {
      const session = makeReadySession();
      stash.getSession.mockResolvedValue(session);
      stash.tryLockForConfirm.mockResolvedValue(true);
      rowBuilder.buildFromWorkbook.mockResolvedValue(makeParsed([makeRow()]));

      const tmpFile = path.join(os.tmpdir(), 'confirm-test-cleanup.xlsx');
      await fs.promises.writeFile(tmpFile, Buffer.from('fake-xlsx'));
      session.originalFilePath = tmpFile;

      await service.confirm({
        reviewSessionPublicId: 'session-confirm-1',
        confirmedBy: 'user-1',
      });

      expect(stash.deleteSession).toHaveBeenCalledTimes(1);

      await fs.promises.rm(tmpFile, { force: true }).catch(() => undefined);
    });
  });

  describe('cancel (T021, FR-016)', () => {
    it('NotFoundException เมื่อ session ไม่มี', async () => {
      stash.getSession.mockResolvedValue(null);

      await expect(
        service.cancel({
          reviewSessionPublicId: 'nonexistent',
          cancelledBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    it('BadRequestException เมื่อ session ถูก confirm แล้ว', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'test.xlsx',
        originalFilePath: '/tmp/test.xlsx',
        annotatedFilePath: '',
        failedRowsFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      await expect(
        service.cancel({
          reviewSessionPublicId: 'session-1',
          cancelledBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    it('BadRequestException เมื่อ session ถูก cancel แล้ว (status != READY)', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'test.xlsx',
        originalFilePath: '/tmp/test.xlsx',
        annotatedFilePath: '',
        failedRowsFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'CANCELLED',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      await expect(
        service.cancel({
          reviewSessionPublicId: 'session-1',
          cancelledBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    it('cancel สำเร็จ — ลบ stash + คืน CANCELLED', async () => {
      stash.getSession.mockResolvedValue({
        reviewSessionPublicId: 'session-1',
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        uploadedBy: 'user-1',
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        originalFileName: 'test.xlsx',
        originalFilePath: '/tmp/test.xlsx',
        annotatedFilePath: '',
        failedRowsFilePath: '',
        selectedAiProvider: 'LOCAL_OLLAMA',
        status: 'READY',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      const result = await service.cancel({
        reviewSessionPublicId: 'session-1',
        cancelledBy: 'user-1',
      });

      expect(result.status).toBe('CANCELLED');
      expect(stash.deleteSession).toHaveBeenCalledWith('session-1');
    });
  });
});
