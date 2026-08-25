// File: backend/src/modules/migration/services/legacy-ingestion.service.spec.ts
// Change Log:
// - 2026-08-20: สร้าง Unit Test สำหรับ LegacyIngestionService (ADR-047)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LegacyIngestionService } from './legacy-ingestion.service';
import { MigrationReviewQueue } from '../entities/migration-review-queue.entity';
import { MigrationProgress } from '../../ai/entities/migration-progress.entity';
import { MigrationError } from '../entities/migration-error.entity';
import { Project } from '../../project/entities/project.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { NotFoundException } from '../../../common/exceptions';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

type MockEntity = Record<string, unknown> & { id?: number; publicId?: string };

describe('LegacyIngestionService (ADR-047)', () => {
  let service: LegacyIngestionService;

  const mockReviewQueueRepo = {
    findOne: jest.fn(),
    create: jest.fn(
      (dto: MockEntity): MockEntity => ({
        ...dto,
        id: 1,
        publicId: '019505a1-7c3e-7000-8000-queue001',
      })
    ),
    save: jest
      .fn()
      .mockImplementation(
        (entity: MockEntity): Promise<MockEntity> =>
          Promise.resolve({ ...entity, id: 1 })
      ),
  };

  const mockProgressRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto: MockEntity): MockEntity => ({ ...dto })),
    save: jest
      .fn()
      .mockImplementation(
        (entity: MockEntity): Promise<MockEntity> => Promise.resolve(entity)
      ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockErrorRepo = {
    create: jest.fn((dto: MockEntity): MockEntity => ({ ...dto, id: 1 })),
    save: jest
      .fn()
      .mockImplementation(
        (entity: MockEntity): Promise<MockEntity> => Promise.resolve(entity)
      ),
  };

  const mockProjectRepo = {
    findOne: jest.fn(),
  };

  const mockOrganizationRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 10, organizationCode: 'ITD', organizationName: 'Italian-Thai' },
      { id: 20, organizationCode: 'TEAM', organizationName: 'Team Consulting' },
    ]),
  };

  const mockCorrespondenceTypeRepo = {
    find: jest.fn().mockResolvedValue([
      { id: 1, typeCode: 'RFA', typeName: 'Request for Approval' },
      { id: 6, typeCode: 'LETTER', typeName: 'Letter' },
    ]),
  };

  // จำลองพฤติกรรมจริงของ BullMQ: หากระบุ custom `jobId` ใน options
  // job.id ที่ได้กลับมาจะเป็น jobId นั้นเป๊ะๆ (ไม่ใช่ auto-generated id)
  // เดิม mock คืนค่า 'job-123' คงที่ ทำให้ไม่จับบั๊ก ai_job_id column overflow ได้ (ADR-047 bugfix)
  const mockAiBatchQueue = {
    add: jest
      .fn()
      .mockImplementation(
        (
          _name: string,
          _data: unknown,
          opts?: { jobId?: string }
        ): Promise<{ id: string }> =>
          Promise.resolve({ id: opts?.jobId ?? 'job-123' })
      ),
  };

  const tempTestDir = path.join(__dirname, '__temp_test_ingest__');
  const tempExcelPath = path.join(tempTestDir, 'test-legacy.xlsx');
  const tempPdfPath = path.join(tempTestDir, 'DOC-001.pdf');

  beforeAll(async () => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
    // สร้าง mock PDF file
    fs.writeFileSync(tempPdfPath, '%PDF-1.4 dummy content');

    // สร้าง mock Excel file
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
      'LCBP3-C2-2024-001',
      'รายงานการตรวจสอบงานก่อสร้างประจำสัปดาห์',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      'Letter',
      'DOC-001.pdf',
      'เอกสารเร่งด่วน',
    ]);
    worksheet.addRow([
      2,
      'LCBP3-C2-2024-002',
      'ขออนุมัติแบบแปลนโครงสร้าง',
      '2024-05-18',
      '2024-05-19',
      'UNKNOWN_ORG',
      'TEAM',
      'RFA',
      'MISSING_FILE.pdf',
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
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: mockReviewQueueRepo,
        },
        {
          provide: getRepositoryToken(MigrationProgress),
          useValue: mockProgressRepo,
        },
        {
          provide: getRepositoryToken(MigrationError),
          useValue: mockErrorRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrganizationRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: mockCorrespondenceTypeRepo,
        },
        {
          provide: 'BullQueue_ai-batch',
          useValue: mockAiBatchQueue,
        },
      ],
    }).compile();

    service = module.get<LegacyIngestionService>(LegacyIngestionService);
  });

  it('ควร throw NotFoundException หากไม่พบไฟล์ Excel', async () => {
    await expect(
      service.startIngestion({
        filePath: '/invalid/path/non-existent.xlsx',
        projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      })
    ).rejects.toThrow(NotFoundException);
  });

  it('ควร throw NotFoundException หากไม่พบ Project UUIDv7', async () => {
    mockProjectRepo.findOne.mockResolvedValue(null);

    await expect(
      service.startIngestion({
        filePath: tempExcelPath,
        projectPublicId: '019505a1-7c3e-7000-8000-proj99999999',
      })
    ).rejects.toThrow(NotFoundException);
  });

  it('ควรอ่านไฟล์ Excel แบบสตรีม และบันทึกแถวเข้าสู่ Staging Queue ได้ถูกต้อง', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.totalRowsProcessed).toBe(2);
    expect(result.enqueuedCount).toBe(2);

    // ตรวจสอบว่า save ลง review queue ถูกเรียก 2 ครั้ง (2 แถว — ไม่มี auto-enqueue แล้ว)
    expect(mockReviewQueueRepo.save).toHaveBeenCalledTimes(2);

    // D156: Ingestion ห้าม auto-enqueue BullMQ — ผู้ใช้ต้องกด Start Extract เอง
    expect(mockAiBatchQueue.add).not.toHaveBeenCalled();

    // ตรวจสอบว่าไฟล์ที่หาไม่พบ (MISSING_FILE.pdf) ถูกบันทึกลง migration_errors
    expect(mockErrorRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: 'LCBP3-C2-2024-002',
      })
    );
  });

  // D156: Ingestion ไม่ auto-enqueue BullMQ อีกต่อไป — aiJobId จะถูกตั้งโดย Start Extract เท่านั้น
  // Test นี้ยืนยันว่า ingestion ไม่ได้ตั้ง aiJobId หรือส่ง job เข้า BullMQ
  it('D156: Ingestion ห้าม auto-enqueue BullMQ — aiJobId ต้องไม่ถูกตั้งหลัง ingestion', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    // ไม่มีการเรียก BullMQ add เลย
    expect(mockAiBatchQueue.add).not.toHaveBeenCalled();

    // ไม่มี queue item ที่มี aiJobId ถูกบันทึก
    const savedWithAiJobId = mockReviewQueueRepo.save.mock.calls
      .map(([entity]: [MockEntity]) => entity)
      .filter((entity: MockEntity) => entity.aiJobId);

    expect(savedWithAiJobId.length).toBe(0);
  });
});
