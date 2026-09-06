// File: backend/src/modules/migration/services/excel-quarantine.service.spec.ts
// Test for ExcelQuarantineService (T019, FR-015, D6)

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MigrationError } from '../entities/migration-error.entity';
import { MigrationReviewQueue } from '../entities/migration-review-queue.entity';
import { ExcelQuarantineService } from './excel-quarantine.service';
import { ExcelAnnotatorService } from './excel-annotator.service';
import { ReviewSessionStashService } from './review-session-stash.service';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
} from '../types/excel-review.types';

describe('ExcelQuarantineService', () => {
  let service: ExcelQuarantineService;
  let errorRepo: jest.Mocked<Pick<Repository<MigrationError>, 'save'>>;
  let queueRepo: jest.Mocked<Pick<Repository<MigrationReviewQueue>, 'save'>>;
  let annotator: jest.Mocked<ExcelAnnotatorService>;
  let stash: jest.Mocked<ReviewSessionStashService>;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quarantine-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    errorRepo = { save: jest.fn() };
    queueRepo = { save: jest.fn() };
    annotator = {
      generateAnnotated: jest.fn().mockResolvedValue(''),
    } as unknown as jest.Mocked<ExcelAnnotatorService>;
    stash = {
      updateFailedRowsPath: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<ReviewSessionStashService>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExcelQuarantineService,
        { provide: getRepositoryToken(MigrationError), useValue: errorRepo },
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: queueRepo,
        },
        { provide: ExcelAnnotatorService, useValue: annotator },
        { provide: ReviewSessionStashService, useValue: stash },
      ],
    }).compile();
    service = moduleRef.get(ExcelQuarantineService);
  });

  const makeRow = (
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow => ({
    rowIndex: 2,
    documentNumber: 'DOC-001',
    subject: 'Test Subject',
    revisionNumber: '0',
    findings: [],
    ...overrides,
  });

  const makeBlockFinding = (row: number): ReviewFinding => ({
    row,
    column: 'document number',
    level: 'BLOCK',
    message: 'Required field missing',
    originalValue: '',
  });

  describe('splitRows', () => {
    it('แยกแถวที่ผ่านและแถวที่ติด BLOCK ถูกต้อง', () => {
      const rows = [
        makeRow({ rowIndex: 2, documentNumber: 'DOC-001' }),
        makeRow({
          rowIndex: 3,
          documentNumber: 'DOC-002',
          findings: [makeBlockFinding(3)],
        }),
        makeRow({ rowIndex: 4, documentNumber: 'DOC-003' }),
      ];

      const result = service.splitRows(rows);
      expect(result.passedRows).toHaveLength(2);
      expect(result.quarantinedRows).toHaveLength(1);
      expect(result.quarantinedRows[0].documentNumber).toBe('DOC-002');
    });

    it('แถวที่มีแค่ WARN ไม่ถูกกักกัน', () => {
      const warnFinding: ReviewFinding = {
        row: 2,
        column: 'subject',
        level: 'WARN',
        message: 'Subject too long',
        originalValue: 'long...',
      };
      const rows = [makeRow({ rowIndex: 2, findings: [warnFinding] })];

      const result = service.splitRows(rows);
      expect(result.passedRows).toHaveLength(1);
      expect(result.quarantinedRows).toHaveLength(0);
    });

    it('แถวที่มี AI_SUGGEST ไม่ถูกกักกัน', () => {
      const aiFinding: ReviewFinding = {
        row: 2,
        column: 'AI Review',
        level: 'AI_SUGGEST',
        message: 'Suggest type RFA',
        originalValue: undefined,
        confidence: 0.9,
      };
      const rows = [makeRow({ rowIndex: 2, findings: [aiFinding] })];

      const result = service.splitRows(rows);
      expect(result.passedRows).toHaveLength(1);
      expect(result.quarantinedRows).toHaveLength(0);
    });

    it('แถวที่มี BLOCK + WARN ถูกกักกัน (BLOCK มี priority)', () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          findings: [
            makeBlockFinding(2),
            {
              row: 2,
              column: 'subject',
              level: 'WARN',
              message: 'Subject too long',
              originalValue: 'long...',
            },
          ],
        }),
      ];

      const result = service.splitRows(rows);
      expect(result.quarantinedRows).toHaveLength(1);
      expect(result.passedRows).toHaveLength(0);
    });
  });

  describe('enqueuePassedRows', () => {
    it('บันทึกแถวที่ผ่านลง migration_review_queue ด้วย status PENDING', async () => {
      const passedRows = [
        makeRow({ rowIndex: 2, documentNumber: 'DOC-001' }),
        makeRow({ rowIndex: 3, documentNumber: 'DOC-002' }),
      ];
      queueRepo.save.mockResolvedValue([
        { id: 1, documentNumber: 'DOC-001' },
        { id: 2, documentNumber: 'DOC-002' },
      ] as unknown as MigrationReviewQueue[]);

      const result = await service.enqueuePassedRows(
        passedRows,
        'batch-uuid-1',
        42
      );

      expect(queueRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      // ตรวจว่า entities ที่ส่งไป save มี status PENDING
      const savedArg = queueRepo.save.mock
        .calls[0][0] as MigrationReviewQueue[];
      expect(savedArg[0].status).toBe('PENDING');
      expect(savedArg[0].batchId).toBe('batch-uuid-1');
      expect(savedArg[0].projectId).toBe(42);
    });

    it('คืน [] เมื่อไม่มีแถวที่ผ่าน', async () => {
      const result = await service.enqueuePassedRows([], 'batch-1', 42);
      expect(result).toEqual([]);
      expect(queueRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('quarantineFailedRows', () => {
    it('บันทึกแถวที่ถูกกักกันลง migration_errors พร้อม error message', async () => {
      const quarantinedRows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-BAD-1',
          findings: [makeBlockFinding(2)],
        }),
      ];
      errorRepo.save.mockResolvedValue([
        { id: 1, documentNumber: 'DOC-BAD-1' },
      ] as unknown as MigrationError[]);

      const result = await service.quarantineFailedRows(
        quarantinedRows,
        'batch-uuid-1'
      );

      expect(errorRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      const savedArg = errorRepo.save.mock.calls[0][0] as MigrationError[];
      expect(savedArg[0].documentNumber).toBe('DOC-BAD-1');
      expect(savedArg[0].batchId).toBe('batch-uuid-1');
      expect(savedArg[0].errorMessage).toContain('Required field missing');
    });

    it('คืน [] เมื่อไม่มีแถวถูกกักกัน', async () => {
      const result = await service.quarantineFailedRows([], 'batch-1');
      expect(result).toEqual([]);
      expect(errorRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('generateFailedRowsExcel', () => {
    it('เรียก annotator.generateAnnotated สำหรับแถวที่ถูกกักกัน', async () => {
      const quarantinedRows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-BAD-1',
          findings: [makeBlockFinding(2)],
        }),
      ];
      const outputPath = path.join(tmpDir, 'failed_rows.xlsx');
      annotator.generateAnnotated.mockResolvedValue(outputPath);

      await service.generateFailedRowsExcel(quarantinedRows, outputPath);

      expect(annotator.generateAnnotated).toHaveBeenCalledTimes(1);
      const callArg = annotator.generateAnnotated.mock.calls[0][0];
      expect(callArg.rows).toBe(quarantinedRows);
      expect(callArg.counts.blockCount).toBe(1);
      expect(callArg.counts.canConfirm).toBe(false);
    });

    it('คืน "" เมื่อไม่มีแถวถูกกักกัน', async () => {
      const result = await service.generateFailedRowsExcel(
        [],
        '/tmp/none.xlsx'
      );
      expect(result).toBe('');
      expect(annotator.generateAnnotated).not.toHaveBeenCalled();
    });
  });

  describe('prepareQuarantine', () => {
    it('แยกแถว + สร้าง failed_rows.xlsx + อัปเดต Redis (MIGRATION_STAGING)', async () => {
      const rows = [
        makeRow({ rowIndex: 2, documentNumber: 'DOC-001' }),
        makeRow({
          rowIndex: 3,
          documentNumber: 'DOC-002',
          findings: [makeBlockFinding(3)],
        }),
      ];
      const stashDir = path.join(tmpDir, 'session-1');
      await fs.mkdir(stashDir, { recursive: true });
      annotator.generateAnnotated.mockResolvedValue(
        path.join(stashDir, 'failed_rows.xlsx')
      );

      const result = await service.prepareQuarantine({
        reviewSessionPublicId: 'session-uuid-1',
        projectPublicId: 'proj-uuid-1',
        targetMode: 'MIGRATION_STAGING',
        rows,
        findings: rows.flatMap((r) => r.findings),
        stashDir,
        confirmedBy: 'user-uuid-1',
      });

      expect(result.passedCount).toBe(1);
      expect(result.quarantinedCount).toBe(1);
      expect(result.batchId).toBeDefined();
      expect(result.failedRowsFilePath).toContain('failed_rows.xlsx');
      expect(stash.updateFailedRowsPath).toHaveBeenCalledWith(
        'session-uuid-1',
        result.failedRowsFilePath
      );
    });

    it('ไม่สร้าง failed_rows.xlsx เมื่อไม่มีแถวถูกกักกัน', async () => {
      const rows = [makeRow({ rowIndex: 2, documentNumber: 'DOC-001' })];
      const stashDir = path.join(tmpDir, 'session-2');
      await fs.mkdir(stashDir, { recursive: true });

      const result = await service.prepareQuarantine({
        reviewSessionPublicId: 'session-uuid-2',
        projectPublicId: 'proj-uuid-1',
        targetMode: 'MIGRATION_STAGING',
        rows,
        findings: [],
        stashDir,
        confirmedBy: 'user-uuid-1',
      });

      expect(result.passedCount).toBe(1);
      expect(result.quarantinedCount).toBe(0);
      expect(result.failedRowsFilePath).toBe('');
      expect(annotator.generateAnnotated).not.toHaveBeenCalled();
      expect(stash.updateFailedRowsPath).not.toHaveBeenCalled();
    });

    it('BadRequestException เมื่อ DIRECT_IMPORT มี BLOCK (Atomic All-or-Nothing)', async () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-001',
          findings: [makeBlockFinding(2)],
        }),
      ];
      const stashDir = path.join(tmpDir, 'session-3');
      await fs.mkdir(stashDir, { recursive: true });

      await expect(
        service.prepareQuarantine({
          reviewSessionPublicId: 'session-uuid-3',
          projectPublicId: 'proj-uuid-1',
          targetMode: 'DIRECT_IMPORT',
          rows,
          findings: rows.flatMap((r) => r.findings),
          stashDir,
          confirmedBy: 'user-uuid-1',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('DIRECT_IMPORT ผ่านเมื่อไม่มี BLOCK', async () => {
      const rows = [makeRow({ rowIndex: 2, documentNumber: 'DOC-001' })];
      const stashDir = path.join(tmpDir, 'session-4');
      await fs.mkdir(stashDir, { recursive: true });

      const result = await service.prepareQuarantine({
        reviewSessionPublicId: 'session-uuid-4',
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        rows,
        findings: [],
        stashDir,
        confirmedBy: 'user-uuid-1',
      });

      expect(result.passedCount).toBe(1);
      expect(result.quarantinedCount).toBe(0);
    });

    it('Fail-Open เมื่อ annotator ล้มเหลว — ยังคืนผลลัพธ์ได้', async () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-002',
          findings: [makeBlockFinding(2)],
        }),
      ];
      const stashDir = path.join(tmpDir, 'session-5');
      await fs.mkdir(stashDir, { recursive: true });
      annotator.generateAnnotated.mockRejectedValue(new Error('disk full'));

      const result = await service.prepareQuarantine({
        reviewSessionPublicId: 'session-uuid-5',
        projectPublicId: 'proj-uuid-1',
        targetMode: 'MIGRATION_STAGING',
        rows,
        findings: rows.flatMap((r) => r.findings),
        stashDir,
        confirmedBy: 'user-uuid-1',
      });

      expect(result.quarantinedCount).toBe(1);
      expect(result.failedRowsFilePath).toBe('');
    });

    it('สร้าง batchId เป็น UUID string', async () => {
      const rows = [makeRow()];
      const stashDir = path.join(tmpDir, 'session-6');
      await fs.mkdir(stashDir, { recursive: true });

      const result = await service.prepareQuarantine({
        reviewSessionPublicId: 'session-uuid-6',
        projectPublicId: 'proj-uuid-1',
        targetMode: 'MIGRATION_STAGING',
        rows,
        findings: [],
        stashDir,
        confirmedBy: 'user-uuid-1',
      });

      // UUIDv7 มี 36 ตัวอักษร รวม hyphens
      expect(result.batchId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});
