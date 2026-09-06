// File: backend/tests/integration/excel-import-review.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — Integration test for Excel Import Review Pipeline
//   (Feature 252, ADR-052, T026, Phase 7)
//   ทดสอบ end-to-end flow: check → confirm และ check → cancel
//   โดยใช้ real service wiring + mocked external dependencies (Redis, DB, filesystem)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// In-memory Redis mock สำหรับ integration test
const redisStore = new Map<string, string>();
const mockRedisClient = {
  set: jest.fn((key: string, val: string) => {
    redisStore.set(key, val);
    return Promise.resolve('OK');
  }),
  get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
  del: jest.fn((key: string) => {
    redisStore.delete(key);
    return Promise.resolve(1);
  }),
  exists: jest.fn((key: string) =>
    Promise.resolve(redisStore.has(key) ? 1 : 0)
  ),
  expire: jest.fn(() => Promise.resolve(1)),
  ttl: jest.fn(() => Promise.resolve(3600)),
  ping: jest.fn(() => Promise.resolve('PONG')),
};

import { ExcelDataReviewService } from '../../src/modules/migration/services/excel-data-review.service';
import { ExcelRowBuilderService } from '../../src/modules/migration/services/excel-row-builder.service';
import { ExcelSchemaValidatorService } from '../../src/modules/migration/services/excel-schema-validator.service';
import { ExcelBusinessRulesService } from '../../src/modules/migration/services/excel-business-rules.service';
import { ReviewSessionStashService } from '../../src/modules/migration/services/review-session-stash.service';
import { AiReviewProviderFactory } from '../../src/modules/migration/services/ai-review-provider.factory';
import { ExcelAnnotatorService } from '../../src/modules/migration/services/excel-annotator.service';
import { ExcelQuarantineService } from '../../src/modules/migration/services/excel-quarantine.service';
import { ExcelDateParserService } from '../../src/modules/migration/services/excel-date-parser.service';
import { ImportTransaction } from '../../src/modules/migration/entities/import-transaction.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import type {
  ReviewTargetMode,
  ExcelCorrespondenceRow,
  ReviewFinding,
} from '../../src/modules/migration/types/excel-review.types';

// ---------- helpers ----------

const makeRow = (): ExcelCorrespondenceRow => ({
  rowIndex: 2,
  documentNumber: 'DOC-001',
  subject: 'Test subject',
  typeCode: 'LTR',
  disciplineCode: 'CIV',
  revisionNumber: '0',
  issuedDate: '2026-01-01',
  receivedDate: '2026-01-02',
  senderRawName: 'Sender Co.',
  receiverRawName: 'Receiver Co.',
  senderOrganizationId: 1,
  receiverOrganizationId: 2,
  attachmentFileName: 'doc-001.pdf',
  resolvedPdfPath: '',
  remarks: '',
  findings: [],
});

// ---------- integration test ----------

describe('Integration: Excel Import Review Pipeline (Feature 252, T026)', () => {
  let service: ExcelDataReviewService;
  let stash: ReviewSessionStashService;
  let quarantine: jest.Mocked<ExcelQuarantineService>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let tmpStashFile: string;

  beforeEach(async () => {
    redisStore.clear();

    tmpStashFile = path.join(
      os.tmpdir(),
      `integration-stash-${Date.now()}.xlsx`
    );
    await fs.promises.writeFile(tmpStashFile, Buffer.from('fake-xlsx-content'));

    const mockRowBuilder = {
      buildFromWorkbook: jest.fn().mockResolvedValue({
        rows: [makeRow()],
        workbook: {},
        headerMapping: { documentNumber: 'A', subject: 'B' },
      }),
    };

    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({
        rows: [makeRow()],
        findings: [] as ReviewFinding[],
        headerMappingFound: true,
      }),
    };

    const mockBusinessRules = {
      validate: jest.fn().mockResolvedValue({
        rows: [makeRow()],
        findings: [] as ReviewFinding[],
      }),
    };

    const mockAiFactory = {
      review: jest.fn().mockResolvedValue({
        findings: [],
        aiAvailable: true,
      }),
    };

    const mockAnnotator = {
      generateAnnotated: jest.fn().mockResolvedValue('/tmp/annotated.xlsx'),
    };

    quarantine = {
      prepareQuarantine: jest.fn().mockResolvedValue({
        passedCount: 1,
        quarantinedCount: 0,
        passedRows: [makeRow()],
        quarantinedRows: [],
        failedRowsFilePath: '',
        batchId: 'batch-int-001',
      }),
      enqueuePassedRows: jest.fn().mockResolvedValue([{ id: 1 }]),
      quarantineFailedRows: jest.fn().mockResolvedValue([]),
      splitRows: jest.fn(),
      generateFailedRowsExcel: jest.fn(),
    } as unknown as jest.Mocked<ExcelQuarantineService>;

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (txMgr: unknown) => Promise<unknown>) => {
          const txMgr = {
            getRepository: jest.fn().mockReturnValue({
              save: jest.fn().mockResolvedValue([{ id: 1 }]),
            }),
          };
          return Promise.resolve(cb(txMgr));
        }),
    } as unknown as jest.Mocked<Pick<DataSource, 'transaction'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExcelDataReviewService,
        ExcelDateParserService,
        ReviewSessionStashService,
        { provide: ExcelRowBuilderService, useValue: mockRowBuilder },
        { provide: ExcelSchemaValidatorService, useValue: mockSchemaValidator },
        { provide: ExcelBusinessRulesService, useValue: mockBusinessRules },
        { provide: AiReviewProviderFactory, useValue: mockAiFactory },
        { provide: ExcelAnnotatorService, useValue: mockAnnotator },
        { provide: ExcelQuarantineService, useValue: quarantine },
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              publicId: '019505a1-7c3e-7000-8000-proj-int-001',
            }),
          },
        },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: { save: jest.fn().mockResolvedValue({ id: 1 }) },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedisClient,
        },
        {
          provide: 'REVIEW_STAGING_ROOT',
          useValue: path.join(os.tmpdir(), 'integration-stash-root'),
        },
      ],
    }).compile();

    service = module.get(ExcelDataReviewService);
    stash = module.get(ReviewSessionStashService);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpStashFile, { force: true }).catch(() => undefined);
  });

  describe('check → confirm flow (FR-014, FR-015, FR-016, FR-017)', () => {
    it('confirm สำเร็จ end-to-end: re-validate → quarantine → DB → cleanup', async () => {
      const session = await stash.createSession({
        projectPublicId: '019505a1-7c3e-7000-8000-proj-int-001',
        targetMode: 'DIRECT_IMPORT' as ReviewTargetMode,
        uploadedBy: '019505a1-7c3e-7000-8000-user-int-001',
        selectedAiProvider: 'LOCAL_OLLAMA',
        originalFileName: 'register.xlsx',
        fileBuffer: Buffer.from('fake-xlsx-content'),
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
      });

      await fs.promises.copyFile(tmpStashFile, session.originalFilePath);

      const result = await service.confirm({
        reviewSessionPublicId: session.reviewSessionPublicId,
        confirmedBy: '019505a1-7c3e-7000-8000-user-int-001',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.batchId).toBeDefined();
      expect(result.targetMode).toBe('DIRECT_IMPORT');
      expect(result.enqueuedCount).toBeGreaterThan(0);
      expect(result.quarantinedCount).toBe(0);

      const deletedSession = await stash.getSession(
        session.reviewSessionPublicId
      );
      expect(deletedSession).toBeNull();

      await fs.promises
        .rm(session.originalFilePath, { force: true })
        .catch(() => undefined);
    });

    it('confirm ปฏิเสธ session ที่หมดอายุ', async () => {
      await expect(
        service.confirm({
          reviewSessionPublicId: 'nonexistent-session-id',
          confirmedBy: 'user-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('check → cancel flow (FR-016)', () => {
    it('cancel สำเร็จ: ลบ stash + คืน CANCELLED', async () => {
      const session = await stash.createSession({
        projectPublicId: '019505a1-7c3e-7000-8000-proj-int-001',
        targetMode: 'DIRECT_IMPORT' as ReviewTargetMode,
        uploadedBy: '019505a1-7c3e-7000-8000-user-int-001',
        selectedAiProvider: 'LOCAL_OLLAMA',
        originalFileName: 'register.xlsx',
        fileBuffer: Buffer.from('fake-xlsx-content'),
        totalRows: 1,
        passCount: 1,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
      });

      await fs.promises.copyFile(tmpStashFile, session.originalFilePath);

      const result = await service.cancel({
        reviewSessionPublicId: session.reviewSessionPublicId,
        cancelledBy: '019505a1-7c3e-7000-8000-user-int-001',
      });

      expect(result.status).toBe('CANCELLED');

      const deletedSession = await stash.getSession(
        session.reviewSessionPublicId
      );
      expect(deletedSession).toBeNull();
    });

    it('cancel ปฏิเสธ session ที่ไม่มี', async () => {
      await expect(
        service.cancel({
          reviewSessionPublicId: 'nonexistent',
          cancelledBy: 'user-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('MIGRATION_STAGING partial quarantine (FR-015)', () => {
    it('MIGRATION_STAGING อนุญาต partial: passed → queue, BLOCK → errors', async () => {
      const session = await stash.createSession({
        projectPublicId: '019505a1-7c3e-7000-8000-proj-int-001',
        targetMode: 'MIGRATION_STAGING' as ReviewTargetMode,
        uploadedBy: '019505a1-7c3e-7000-8000-user-int-001',
        selectedAiProvider: 'LOCAL_OLLAMA',
        originalFileName: 'register.xlsx',
        fileBuffer: Buffer.from('fake-xlsx-content'),
        totalRows: 2,
        passCount: 1,
        warnCount: 0,
        blockCount: 1,
        aiSuggestCount: 0,
      });

      await fs.promises.copyFile(tmpStashFile, session.originalFilePath);

      const blockRow: ExcelCorrespondenceRow = {
        ...makeRow(),
        documentNumber: 'DOC-002',
        findings: [
          {
            row: 3,
            column: 'A',
            level: 'BLOCK',
            message: 'Invalid',
            originalValue: 'bad',
          },
        ],
      };

      quarantine.prepareQuarantine.mockResolvedValue({
        passedCount: 1,
        quarantinedCount: 1,
        passedRows: [makeRow()],
        quarantinedRows: [blockRow],
        failedRowsFilePath: '/tmp/failed-rows.xlsx',
        batchId: 'batch-partial-001',
      });

      const result = await service.confirm({
        reviewSessionPublicId: session.reviewSessionPublicId,
        confirmedBy: '019505a1-7c3e-7000-8000-user-int-001',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.quarantinedCount).toBe(1);
      expect(result.enqueuedCount).toBeGreaterThan(0);

      await fs.promises
        .rm(session.originalFilePath, { force: true })
        .catch(() => undefined);
    });
  });
});
