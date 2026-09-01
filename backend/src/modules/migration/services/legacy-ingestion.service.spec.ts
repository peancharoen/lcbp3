// File: backend/src/modules/migration/services/legacy-ingestion.service.spec.ts
// Change Log:
// - 2026-08-20: สร้าง Unit Test สำหรับ LegacyIngestionService (ADR-047)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LegacyIngestionService } from './legacy-ingestion.service';
import { MigrationReviewQueue } from '../entities/migration-review-queue.entity';
import {
  MigrationProgress,
  MigrationProgressStatus,
} from '../../ai/entities/migration-progress.entity';
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

  // ─── Resume / Checkpoint Tests ────────────────────────────────────────────

  it('ควร resume จาก checkpoint เมื่อ resume=true และมี progressEntity อยู่', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    mockProgressRepo.findOne.mockResolvedValue({
      batchId: 'BATCH-RESUME-001',
      lastProcessedIndex: 2, // ข้าม header (row 1) + data row 1 (row 2)
      status: MigrationProgressStatus.RUNNING,
    });

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'BATCH-RESUME-001',
      resume: true,
    });

    // startIndex = 2 → ข้ามแถวที่ 2 (first data row) → ประมวลผลเฉพาะแถวที่ 3
    expect(result.totalRowsProcessed).toBe(1);
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('ควรไม่ resume เมื่อ progressEntity มีอยู่และ resume=false', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    mockProgressRepo.findOne.mockResolvedValue({
      batchId: 'BATCH-NORESUME-001',
      lastProcessedIndex: 5,
      status: MigrationProgressStatus.RUNNING,
    });

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'BATCH-NORESUME-001',
      resume: false,
    });

    // resume=false → startIndex=0 → ประมวลผลทุกแถว
    expect(result.totalRowsProcessed).toBe(2);
  });

  it('ควรเรียก onProgress callback ระหว่างประมวลผล', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const progressCalls: Array<{
      processed: number;
      enqueued: number;
    }> = [];

    await service.startIngestion(
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

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0].enqueued).toBeGreaterThan(0);
  });

  it('ควรตรวจจับ duplicate document number ใน batch เดียวกันและสร้าง revision suffix', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // จำลองว่าแถวแรกถูกพบใน reviewQueue อยู่แล้ว (batchId เดียวกัน)
    mockReviewQueueRepo.findOne
      .mockResolvedValueOnce({
        id: 100,
        batchId: 'BATCH-DUP-001',
        documentNumber: 'LCBP3-C2-2024-001',
      })
      .mockResolvedValueOnce(null) // ไม่พบ -R1
      .mockResolvedValueOnce(null) // แถวที่ 2 ไม่ซ้ำ
      .mockResolvedValueOnce(null);

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'BATCH-DUP-001',
    });

    expect(result.enqueuedCount).toBe(2);
    // ตรวจสอบว่ามีการ save ด้วย documentNumber ที่มี -R1 suffix
    const savedDocNumbers = mockReviewQueueRepo.save.mock.calls
      .map(([entity]: [MockEntity]) => entity.documentNumber)
      .filter((n: unknown): n is string => typeof n === 'string');
    expect(savedDocNumbers).toContain('LCBP3-C2-2024-001-R1');
  });

  it('ควรบันทึก error และยังคงประมวลผลแถวถัดไปเมื่อ row processing ล้มเหลว', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // จำลองให้ reviewQueueRepo.findOne throw เพื่อ trigger row error
    mockReviewQueueRepo.findOne
      .mockRejectedValueOnce(new Error('DB connection lost'))
      .mockResolvedValueOnce(null);

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    expect(result.errorCount).toBe(1);
    expect(result.enqueuedCount).toBe(1);
    expect(mockErrorRepo.save).toHaveBeenCalled();
  });

  it('ควร detect header ที่ใช้ภาษาอังกฤษ (EN headers)', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // สร้างไฟล์ Excel ที่มี 2 sheets
    const multiSheetPath = path.join(tempTestDir, 'multi-sheet.xlsx');
    const workbook = new ExcelJS.Workbook();
    const ws1 = workbook.addWorksheet('Data');
    ws1.addRow(['เลขที่เอกสาร', 'เรื่อง']);
    ws1.addRow(['DOC-001', 'Test']);
    const ws2 = workbook.addWorksheet('Summary');
    ws2.addRow(['Total', 'Count']);
    ws2.addRow([10, 20]);
    await workbook.xlsx.writeFile(multiSheetPath);

    const result = await service.startIngestion({
      filePath: multiSheetPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      sheetName: 'Data',
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.totalRowsProcessed).toBe(1);
  });

  it('ควรใช้ staging folder จาก env MIGRATION_STAGING_DIR เมื่อไม่ระบุ pdfFolderPath', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });
    process.env.MIGRATION_STAGING_DIR = tempTestDir;

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
    });

    expect(result.status).toBe('COMPLETED');
    delete process.env.MIGRATION_STAGING_DIR;
  });

  it('ควร resolve correspondence type จาก numeric ID ใน Excel', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // สร้างไฟล์ Excel ที่มี correspondence_type_id เป็นตัวเลข
    const numericTypePath = path.join(tempTestDir, 'numeric-type.xlsx');
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
      'correspondence_type',
      'ชื่อไฟล์',
      'หมายเหตุ',
    ]);
    worksheet.addRow([
      1,
      'DOC-TYPE-001',
      'Test doc',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      '',
      1, // numeric ID → should resolve to 'RFA'
      '',
      '',
    ]);
    await workbook.xlsx.writeFile(numericTypePath);

    await service.startIngestion({
      filePath: numericTypePath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    // ตรวจสอบว่า aiSuggestedCorrespondenceType ถูกตั้งเป็น 'RFA' (resolved from id=1)
    const savedEntity = (
      mockReviewQueueRepo.save.mock.calls[0] as unknown[]
    )[0] as MockEntity;
    expect(savedEntity.aiSuggestedCorrespondenceType).toBe('RFA');
  });

  it('ควร resolve correspondence type จาก type code ใน Excel', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const codeTypePath = path.join(tempTestDir, 'code-type.xlsx');
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
      'type_id',
      'ชื่อไฟล์',
      'หมายเหตุ',
    ]);
    worksheet.addRow([
      1,
      'DOC-CODE-001',
      'Test doc',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      '',
      'LETTER', // type code → should resolve to 'LETTER'
      '',
      '',
    ]);
    await workbook.xlsx.writeFile(codeTypePath);

    await service.startIngestion({
      filePath: codeTypePath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    const savedEntity = (
      mockReviewQueueRepo.save.mock.calls[0] as unknown[]
    )[0] as MockEntity;
    expect(savedEntity.aiSuggestedCorrespondenceType).toBe('LETTER');
  });

  it('ควรบันทึก unresolved orgs ใน details เมื่อ sender/receiver ไม่ตรงกับ master data', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const unresolvedPath = path.join(tempTestDir, 'unresolved.xlsx');
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
      'DOC-UNRESOLVED-001',
      'Test',
      '2024-05-15',
      '2024-05-16',
      'UNKNOWN_ORG',
      'ALSO_UNKNOWN',
      '',
      '',
      '',
    ]);
    await workbook.xlsx.writeFile(unresolvedPath);

    await service.startIngestion({
      filePath: unresolvedPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    const savedEntity = (
      mockReviewQueueRepo.save.mock.calls[0] as unknown[]
    )[0] as MockEntity;
    const details = savedEntity.details as Record<string, unknown>;
    const unresolvedOrgs = details.unresolved_orgs as Record<string, string>;
    expect(unresolvedOrgs).toBeDefined();
    expect(unresolvedOrgs.sender).toBe('UNKNOWN_ORG');
    expect(unresolvedOrgs.receiver).toBe('ALSO_UNKNOWN');
  });

  it('ควร resolve staging PDF แม้ไม่มีนามสกุล .pdf', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // สร้างไฟล์ PDF โดยไม่มีนามสกุล
    const noExtPdfPath = path.join(tempTestDir, 'DOC-NOEXT');
    fs.writeFileSync(noExtPdfPath, '%PDF-1.4 dummy');

    const noExtPath = path.join(tempTestDir, 'no-ext-pdf.xlsx');
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
      'DOC-NOEXT-001',
      'Test',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      '',
      'DOC-NOEXT',
      '',
    ]);
    await workbook.xlsx.writeFile(noExtPath);

    await service.startIngestion({
      filePath: noExtPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    const savedEntity = (
      mockReviewQueueRepo.save.mock.calls[0] as unknown[]
    )[0] as MockEntity;
    const details = savedEntity.details as Record<string, unknown>;
    expect(details.source_file_path).toContain('DOC-NOEXT');
  });

  it('ควรข้ามแถวที่ไม่มีเลขที่เอกสาร', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const emptyDocPath = path.join(tempTestDir, 'empty-doc.xlsx');
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
      '',
      'No doc number',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      '',
      '',
      '',
    ]);
    worksheet.addRow([
      2,
      'DOC-VALID-001',
      'Has doc number',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      '',
      '',
      '',
    ]);
    await workbook.xlsx.writeFile(emptyDocPath);

    const result = await service.startIngestion({
      filePath: emptyDocPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    expect(result.enqueuedCount).toBe(1);
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('ควรอัปเดต progress checkpoint ทุก 50 แถว', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    // สร้างไฟล์ Excel ที่มี 51 แถวเพื่อ trigger checkpoint ที่แถวที่ 50
    const largePath = path.join(tempTestDir, 'large.xlsx');
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
    for (let i = 1; i <= 51; i++) {
      worksheet.addRow([
        i,
        `DOC-${String(i).padStart(3, '0')}`,
        `Subject ${i}`,
        '2024-05-15',
        '2024-05-16',
        'ITD',
        'TEAM',
        '',
        '',
        '',
      ]);
    }
    await workbook.xlsx.writeFile(largePath);

    mockReviewQueueRepo.findOne.mockResolvedValue(null);

    await service.startIngestion({
      filePath: largePath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    // ตรวจสอบว่ามีการ update checkpoint (ที่แถว 50)
    const updateCalls = mockProgressRepo.update.mock.calls.filter(
      (call: unknown[]) => {
        const args = call[1] as Record<string, unknown> | undefined;
        return args?.status === MigrationProgressStatus.RUNNING;
      }
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('ควรใช้ batchId ที่ส่งมาแทนการ generate ใหม่', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const result = await service.startIngestion({
      filePath: tempExcelPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
      batchId: 'CUSTOM-BATCH-001',
    });

    expect(result.batchId).toBe('CUSTOM-BATCH-001');
  });

  it('ควร detect header ที่ใช้ภาษาอังกฤษ (EN headers)', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 5,
      publicId: '019505a1-7c3e-7000-8000-proj12345678',
      projectCode: 'LCBP3-C2',
    });

    const enHeaderPath = path.join(tempTestDir, 'en-headers.xlsx');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow([
      'No',
      'Document No',
      'Subject',
      'Date of Issue',
      'Date Received',
      'From',
      'To',
      'Category',
      'File Name',
      'Remark',
    ]);
    worksheet.addRow([
      1,
      'EN-DOC-001',
      'English headers test',
      '2024-05-15',
      '2024-05-16',
      'ITD',
      'TEAM',
      'RFA',
      '',
      '',
    ]);
    await workbook.xlsx.writeFile(enHeaderPath);

    const result = await service.startIngestion({
      filePath: enHeaderPath,
      projectPublicId: '019505a1-7c3e-7000-8000-proj12345678',
      pdfFolderPath: tempTestDir,
    });

    expect(result.enqueuedCount).toBe(1);
  });
});
