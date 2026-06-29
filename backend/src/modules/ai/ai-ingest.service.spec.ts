// File: src/modules/ai/ai-ingest.service.spec.ts
// Change Log
// - 2026-05-14: เพิ่ม Unit Tests ครอบคลุม AiIngestService — ingest, listQueue, approve (ADR-023).
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Readable } from 'stream';
import { AiIngestService } from './ai-ingest.service';
import { AiQueueService } from './ai-queue.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { MigrationService } from '../migration/migration.service';
import {
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from './entities/migration-review.entity';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeFile(
  overrides: Partial<Express.Multer.File> = {}
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('pdf-content'),
    size: 1024,
    stream: new Readable(),
    destination: '',
    filename: 'test.pdf',
    path: '',
    ...overrides,
  };
}

function makePendingRecord(
  overrides: Partial<MigrationReviewRecord> = {}
): MigrationReviewRecord {
  return {
    id: 1,
    publicId: 'rec-uuid-001',
    batchId: 'batch-001',
    originalFileName: 'test.pdf',
    sourceAttachmentPublicId: 'att-uuid-001',
    tempAttachmentId: 10,
    extractedMetadata: { subject: 'Test' },
    confidenceScore: 0.9,
    status: MigrationReviewRecordStatus.PENDING,
    errorReason: undefined,
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as MigrationReviewRecord;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockConfig = {
  get: jest.fn((key: string) => (key === 'AI_SERVICE_USER_ID' ? 1 : undefined)),
};

const mockFileStorage = {
  upload: jest.fn().mockResolvedValue({ id: 10, publicId: 'att-uuid-001' }),
};

const mockAiQueue = {
  enqueueIngest: jest.fn().mockResolvedValue('job-id-001'),
};

const mockMigration = {
  importCorrespondence: jest
    .fn()
    .mockResolvedValue({ publicId: 'corr-uuid-001' }),
};

const mockReviewRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
};

const mockAuditLogRepo = {
  create: jest.fn(),
  save: jest.fn().mockResolvedValue({}),
};

const mockProjectRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 5, publicId: 'proj-uuid-001' }),
};

const mockOrgRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 3, publicId: 'org-uuid-001' }),
};

const mockCorrTypeRepo = {
  findOne: jest
    .fn()
    .mockResolvedValue({ id: 2, typeCode: 'CORR', typeName: 'Correspondence' }),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AiIngestService', () => {
  let service: AiIngestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiIngestService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: FileStorageService, useValue: mockFileStorage },
        { provide: AiQueueService, useValue: mockAiQueue },
        { provide: MigrationService, useValue: mockMigration },
        {
          provide: getRepositoryToken(MigrationReviewRecord),
          useValue: mockReviewRepo,
        },
        { provide: getRepositoryToken(AiAuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Organization), useValue: mockOrgRepo },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: mockCorrTypeRepo,
        },
      ],
    }).compile();

    service = module.get<AiIngestService>(AiIngestService);
    jest.clearAllMocks();

    // ค่าเริ่มต้นของ mocks หลัง clearAllMocks
    mockConfig.get.mockImplementation((key: string) =>
      key === 'AI_SERVICE_USER_ID' ? 1 : undefined
    );
    mockFileStorage.upload.mockResolvedValue({
      id: 10,
      publicId: 'att-uuid-001',
    });
    mockAiQueue.enqueueIngest.mockResolvedValue('job-id-001');
    mockMigration.importCorrespondence.mockResolvedValue({
      publicId: 'corr-uuid-001',
    });
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: 'proj-uuid-001',
    });
    mockOrgRepo.findOne.mockResolvedValue({ id: 3, publicId: 'org-uuid-001' });
    mockCorrTypeRepo.findOne.mockResolvedValue({
      id: 2,
      typeCode: 'CORR',
      typeName: 'Correspondence',
    });
    mockAuditLogRepo.create.mockReturnValue({});
    mockAuditLogRepo.save.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── ingest() ──────────────────────────────────────────────────────────────

  describe('ingest()', () => {
    it('ควร throw ValidationException เมื่อไม่มีไฟล์และไม่มี records', async () => {
      await expect(
        service.ingest({ batchId: 'batch-001', records: [] }, [])
      ).rejects.toThrow(ValidationException);
    });

    it('ควร throw ValidationException เมื่อไฟล์เกิน 50MB', async () => {
      const bigFile = makeFile({ size: 51 * 1024 * 1024 });
      await expect(
        service.ingest({ batchId: 'batch-001' }, [bigFile])
      ).rejects.toThrow(ValidationException);
    });

    it('ควร throw ValidationException เมื่อ MIME type ไม่รองรับ (image/png)', async () => {
      const pngFile = makeFile({ mimetype: 'image/png' });
      await expect(
        service.ingest({ batchId: 'batch-001' }, [pngFile])
      ).rejects.toThrow(ValidationException);
    });

    it('ควร throw ValidationException เมื่อ records JSON ไม่ถูกต้อง', async () => {
      await expect(
        service.ingest({ batchId: 'batch-001', records: '{invalid-json' }, [])
      ).rejects.toThrow(ValidationException);
    });

    it('ควรสร้าง staging record และ enqueue job เมื่อรับไฟล์ที่ถูกต้อง', async () => {
      const file = makeFile();
      const createdRecord = makePendingRecord();
      mockReviewRepo.create.mockReturnValue(createdRecord);
      mockReviewRepo.save.mockResolvedValue([createdRecord]);

      const result = await service.ingest({ batchId: 'batch-001' }, [file]);

      expect(mockFileStorage.upload).toHaveBeenCalledWith(file, 1);
      expect(mockReviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ batchId: 'batch-001' })
      );
      expect(mockAiQueue.enqueueIngest).toHaveBeenCalledWith(
        expect.objectContaining({ batchId: 'batch-001' })
      );
      expect(result).toMatchObject({ batchId: 'batch-001', queued: 1 });
    });

    it('ควรสร้างหลาย record จาก records JSON (ไม่มีไฟล์)', async () => {
      const records = [
        { originalFileName: 'doc-1.pdf', confidenceScore: 0.9 },
        { originalFileName: 'doc-2.pdf', confidenceScore: 0.8 },
      ];
      const createdRecord = makePendingRecord();
      mockReviewRepo.create.mockReturnValue(createdRecord);
      mockReviewRepo.save.mockResolvedValue([createdRecord, createdRecord]);

      const result = await service.ingest(
        { batchId: 'batch-002', records },
        []
      );

      expect(mockReviewRepo.create).toHaveBeenCalledTimes(2);
      expect(result.queued).toBe(2);
    });

    it('ควรยอมรับ records เป็น JSON string', async () => {
      const recordsStr = JSON.stringify([{ originalFileName: 'doc.pdf' }]);
      const createdRecord = makePendingRecord();
      mockReviewRepo.create.mockReturnValue(createdRecord);
      mockReviewRepo.save.mockResolvedValue([createdRecord]);

      await expect(
        service.ingest({ batchId: 'batch-003', records: recordsStr }, [])
      ).resolves.toMatchObject({ batchId: 'batch-003', queued: 1 });
    });
  });

  // ─── deriveStatus() (ผ่าน ingest) ─────────────────────────────────────────

  describe('deriveStatus — สถานะจาก record input', () => {
    beforeEach(() => {
      mockReviewRepo.save.mockImplementation(
        (records: MigrationReviewRecord[]) => Promise.resolve(records)
      );
    });

    it('ควร derive REJECTED เมื่อ confidenceScore < 0.6', async () => {
      mockReviewRepo.create.mockImplementation(
        (data: Partial<MigrationReviewRecord>) =>
          ({ ...data }) as MigrationReviewRecord
      );
      const records = [{ originalFileName: 'low.pdf', confidenceScore: 0.5 }];

      await service.ingest({ batchId: 'b', records }, []);

      expect(mockReviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MigrationReviewRecordStatus.REJECTED,
        })
      );
    });

    it('ควร derive REJECTED เมื่อมี errorReason', async () => {
      mockReviewRepo.create.mockImplementation(
        (data: Partial<MigrationReviewRecord>) =>
          ({ ...data }) as MigrationReviewRecord
      );
      const records = [
        { originalFileName: 'err.pdf', errorReason: 'OCR failed' },
      ];

      await service.ingest({ batchId: 'b', records }, []);

      expect(mockReviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MigrationReviewRecordStatus.REJECTED,
        })
      );
    });

    it('ควร derive PENDING เมื่อ confidence >= 0.6 และไม่มี errorReason', async () => {
      mockReviewRepo.create.mockImplementation(
        (data: Partial<MigrationReviewRecord>) =>
          ({ ...data }) as MigrationReviewRecord
      );
      const records = [{ originalFileName: 'ok.pdf', confidenceScore: 0.85 }];

      await service.ingest({ batchId: 'b', records }, []);

      expect(mockReviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: MigrationReviewRecordStatus.PENDING })
      );
    });
  });

  // ─── listQueue() ───────────────────────────────────────────────────────────

  describe('listQueue()', () => {
    it('ควรคืน paginated response ที่ถูกต้อง', async () => {
      const items = [makePendingRecord(), makePendingRecord()];
      mockReviewRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([items, 25]),
      });

      const result = await service.listQueue({ page: 2, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3); // Math.ceil(25/10)
      expect(result.items).toHaveLength(2);
    });

    it('ควรใช้ค่า default page=1, limit=20 เมื่อไม่ระบุ', async () => {
      const qb = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockReviewRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listQueue({});

      expect(qb.skip).toHaveBeenCalledWith(0); // (1-1)*20
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });

  // ─── approve() ─────────────────────────────────────────────────────────────

  describe('approve()', () => {
    const dto = {
      documentNumber: 'CORR-001',
      subject: 'Test Subject',
      categoryCode: 'CORR',
      projectPublicId: 'proj-uuid-001',
      finalMetadata: { subject: 'Corrected Subject' },
    };

    it('ควร throw ValidationException เมื่อ idempotencyKey ว่าง', async () => {
      await expect(service.approve('rec-uuid-001', dto, '', 1)).rejects.toThrow(
        ValidationException
      );
    });

    it('ควร throw NotFoundException เมื่อไม่พบ record', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve('not-found', dto, 'idem-key-001', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BusinessException เมื่อ record ไม่อยู่ในสถานะ PENDING (IMPORTED)', async () => {
      mockReviewRepo.findOne.mockResolvedValue(
        makePendingRecord({ status: MigrationReviewRecordStatus.IMPORTED })
      );

      await expect(
        service.approve('rec-uuid-001', dto, 'idem-key-001', 1)
      ).rejects.toThrow(BusinessException);
    });

    it('ควร throw NotFoundException เมื่อ Project ไม่พบ', async () => {
      mockReviewRepo.findOne.mockResolvedValue(makePendingRecord());
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve('rec-uuid-001', dto, 'idem-key-001', 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('ควรอนุมัติ record สำเร็จ — เรียก importCorrespondence และบันทึก AuditLog', async () => {
      const record = makePendingRecord();
      mockReviewRepo.findOne.mockResolvedValue(record);
      mockReviewRepo.save.mockResolvedValue({
        ...record,
        status: MigrationReviewRecordStatus.IMPORTED,
      });

      const result = await service.approve(
        'rec-uuid-001',
        dto,
        'idem-key-001',
        99
      );

      // ตรวจสอบการเรียก importCorrespondence
      expect(mockMigration.importCorrespondence).toHaveBeenCalledWith(
        expect.objectContaining({
          documentNumber: 'CORR-001',
          subject: 'Test Subject',
          category: 'CORR',
          projectId: 5,
        }),
        'idem-key-001',
        99
      );

      // ตรวจสอบสถานะที่ถูก save เป็น IMPORTED
      expect(mockReviewRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MigrationReviewRecordStatus.IMPORTED,
        })
      );

      // ตรวจสอบ AuditLog ถูกสร้าง (T025)
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentPublicId: record.publicId,
          confirmedByUserId: 99,
        })
      );
      expect(mockAuditLogRepo.save).toHaveBeenCalled();

      expect(result.record).toBeDefined();
      expect(result.importResult).toBeDefined();
    });

    it('T025: AuditLog ควรบันทึก aiSuggestionJson และ humanOverrideJson (AI vs Human diff)', async () => {
      const record = makePendingRecord({
        extractedMetadata: { subject: 'AI Guess' },
        confidenceScore: 0.85,
      });
      mockReviewRepo.findOne.mockResolvedValue(record);
      mockReviewRepo.save.mockResolvedValue({
        ...record,
        status: MigrationReviewRecordStatus.IMPORTED,
      });

      await service.approve(
        'rec-uuid-001',
        { ...dto, finalMetadata: { subject: 'Human Corrected' } },
        'idem-key-002',
        42
      );

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          confidenceScore: expect.closeTo(0.85),
          humanOverrideJson: { subject: 'Human Corrected' },
        })
      );
    });

    it('ควรไม่ throw แม้ auditLogRepo.save จะล้มเหลว (error ถูก swallow)', async () => {
      const record = makePendingRecord();
      mockReviewRepo.findOne.mockResolvedValue(record);
      mockReviewRepo.save.mockResolvedValue({
        ...record,
        status: MigrationReviewRecordStatus.IMPORTED,
      });
      mockAuditLogRepo.save.mockRejectedValueOnce(
        new Error('DB connection lost')
      );

      // ไม่ควร throw ออกมา — saveApprovalAuditLog มี try/catch
      await expect(
        service.approve('rec-uuid-001', dto, 'idem-key-003', 1)
      ).resolves.toBeDefined();
    });
  });
});
