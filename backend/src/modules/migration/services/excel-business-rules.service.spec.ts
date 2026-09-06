// File: backend/src/modules/migration/services/excel-business-rules.service.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ Layer 1 + Layer 2 (T011)
//   ครอบคลุม FR-003 (Schema), FR-005 (Chronology), FR-006 (Org resolution),
//   FR-007 (Revision semantics), D14 (Project mismatch), D9 (Attachments)

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../../master/entities/discipline.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { Project } from '../../project/entities/project.entity';
import { ExcelSchemaValidatorService } from './excel-schema-validator.service';
import { ExcelBusinessRulesService } from './excel-business-rules.service';
import { ExcelDateParserService } from './excel-date-parser.service';
import { ExcelRowBuilderResult } from './excel-row-builder.service';
import { ExcelCorrespondenceRow } from '../types/excel-review.types';

/** Mock repository factory — คืน jest.Mock สำหรับ findOne/find */
const mockRepo = <T>(): jest.Mocked<Pick<T, 'findOne' | 'find'>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
  }) as unknown as jest.Mocked<Pick<T, 'findOne' | 'find'>>;

describe('Layer 1 — ExcelSchemaValidatorService', () => {
  let service: ExcelSchemaValidatorService;

  beforeEach(() => {
    service = new ExcelSchemaValidatorService();
  });

  const makeRow = (
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow => ({
    rowIndex: 2,
    documentNumber: 'NP-DMS-2025-001',
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

  describe('header mapping', () => {
    it('BLOCK ทั้งไฟล์เมื่อ headerMappingFound = false', () => {
      const result = service.validate({
        headerMappingFound: false,
        sheetNames: ['Junk'],
        skippedRows: 0,
        rows: [],
      });

      expect(result.workbookReadable).toBe(true);
      expect(result.headerMappingFound).toBe(false);
      expect(result.rows).toEqual([]);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].level).toBe('BLOCK');
      expect(result.findings[0].message).toContain('ไม่พบแถวหัวคอลัมน์');
    });

    it('ผ่านเมื่อ headerMappingFound = true และแถวครบ', () => {
      const result = service.validate(makeParsed([makeRow()]));

      expect(result.headerMappingFound).toBe(true);
      expect(result.findings).toEqual([]);
    });
  });

  describe('Document Number (บังคับ + ความยาว)', () => {
    it('BLOCK เมื่อ documentNumber ว่าง', () => {
      const result = service.validate(
        makeParsed([makeRow({ documentNumber: '' })])
      );

      const block = result.findings.find((f) => f.level === 'BLOCK');
      expect(block).toBeDefined();
      expect(block?.message).toContain('เลขที่เอกสารบังคับระบุ');
    });

    it('BLOCK เมื่อ documentNumber ยาวเกิน 100 ตัวอักษร', () => {
      const longDoc = 'X'.repeat(101);
      const result = service.validate(
        makeParsed([makeRow({ documentNumber: longDoc })])
      );

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.column === 'Document Number'
      );
      expect(block).toBeDefined();
      expect(block?.message).toContain('ยาวเกินกว่า 100');
    });
  });

  describe('Subject (บังคับ + ความยาว)', () => {
    it('BLOCK เมื่อ subject ว่าง', () => {
      const result = service.validate(makeParsed([makeRow({ subject: '' })]));

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.column === 'Subject'
      );
      expect(block).toBeDefined();
    });

    it('WARN เมื่อ subject ยาวเกิน 500 ตัวอักษร', () => {
      const longSubject = 'เรื่องยาวมาก'.repeat(150); // > 500
      const result = service.validate(
        makeParsed([makeRow({ subject: longSubject })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'Subject'
      );
      expect(warn).toBeDefined();
    });
  });

  describe('Revision label', () => {
    it('WARN เมื่อ revisionNumber ยาวเกิน 10 ตัวอักษร', () => {
      const result = service.validate(
        makeParsed([makeRow({ revisionNumber: 'REV-VERY-LONG-001' })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'Revision'
      );
      expect(warn).toBeDefined();
    });

    it('ผ่านเมื่อ revisionNumber สั้น ("0", "1", "A")', () => {
      const result = service.validate(
        makeParsed([makeRow({ revisionNumber: 'A' })])
      );
      expect(
        result.findings.find((f) => f.column === 'Revision')
      ).toBeUndefined();
    });
  });

  describe('Organization raw text', () => {
    it('WARN เมื่อ senderOrgRaw ยาวเกิน 255 ตัวอักษร', () => {
      const longOrg = 'หน่วยงาน'.repeat(100);
      const result = service.validate(
        makeParsed([makeRow({ senderOrgRaw: longOrg })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'From'
      );
      expect(warn).toBeDefined();
    });

    it('WARN เมื่อ receiverOrgRaw ยาวเกิน 255 ตัวอักษร', () => {
      const longOrg = 'หน่วยงาน'.repeat(100);
      const result = service.validate(
        makeParsed([makeRow({ receiverOrgRaw: longOrg })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'To'
      );
      expect(warn).toBeDefined();
    });
  });

  describe('File Name + Remarks', () => {
    it('WARN เมื่อ fileName ยาวเกิน 255 ตัวอักษร', () => {
      const longName = 'file'.repeat(100);
      const result = service.validate(
        makeParsed([makeRow({ fileName: longName })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'File Name'
      );
      expect(warn).toBeDefined();
    });

    it('WARN เมื่อ remarks ยาวเกิน 1000 ตัวอักษร', () => {
      const longRemarks = 'หมายเหตุ'.repeat(300);
      const result = service.validate(
        makeParsed([makeRow({ remarks: longRemarks })])
      );

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'Remarks'
      );
      expect(warn).toBeDefined();
    });
  });
});

describe('Layer 2 — ExcelBusinessRulesService', () => {
  let service: ExcelBusinessRulesService;
  let orgRepo: jest.Mocked<Pick<Repository<Organization>, 'findOne' | 'find'>>;
  let typeRepo: jest.Mocked<
    Pick<Repository<CorrespondenceType>, 'findOne' | 'find'>
  >;
  let disciplineRepo: jest.Mocked<
    Pick<Repository<Discipline>, 'findOne' | 'find'>
  >;
  let corrRepo: jest.Mocked<
    Pick<Repository<Correspondence>, 'findOne' | 'find'>
  >;
  let projectRepo: jest.Mocked<Pick<Repository<Project>, 'findOne' | 'find'>>;

  // Import Repository type at top of describe to avoid TS issues
  type Repository<T> = import('typeorm').Repository<T>;

  const makeRow = (
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow => ({
    rowIndex: 2,
    documentNumber: 'NP-DMS-2025-001',
    subject: 'เรื่องทดสอบ',
    revisionNumber: '0',
    findings: [],
    ...overrides,
  });

  beforeEach(async () => {
    orgRepo = mockRepo();
    typeRepo = mockRepo();
    disciplineRepo = mockRepo();
    corrRepo = mockRepo();
    projectRepo = mockRepo();

    // default: project มีอยู่
    projectRepo.findOne.mockResolvedValue({
      id: 1,
      publicId: 'proj-uuid-1',
    } as Partial<Project> as Project);

    // default: orgs/types/disciplines ไม่เจอ
    orgRepo.find.mockResolvedValue([]);
    typeRepo.find.mockResolvedValue([]);
    disciplineRepo.find.mockResolvedValue([]);
    corrRepo.find.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ExcelBusinessRulesService,
        ExcelDateParserService,
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
        { provide: getRepositoryToken(CorrespondenceType), useValue: typeRepo },
        { provide: getRepositoryToken(Discipline), useValue: disciplineRepo },
        { provide: getRepositoryToken(Correspondence), useValue: corrRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    service = module.get<ExcelBusinessRulesService>(ExcelBusinessRulesService);
  });

  describe('project ตรวจสอบ', () => {
    it('BLOCK ทั้งไฟล์เมื่อ project ไม่มีอยู่', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      const result = await service.validate({
        rows: [makeRow()],
        projectPublicId: 'nonexistent-uuid',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.column === 'Project'
      );
      expect(block).toBeDefined();
      expect(block?.message).toContain('ไม่พบโครงการ');
    });
  });

  describe('duplicate doc number + revision ภายในไฟล์', () => {
    it('BLOCK เมื่อเลขที่เอกสาร + revision ซ้ำในไฟล์เดียวกัน', async () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-001',
          revisionNumber: '0',
        }),
        makeRow({
          rowIndex: 3,
          documentNumber: 'DOC-001',
          revisionNumber: '0',
        }),
      ];

      const result = await service.validate({
        rows,
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.row === 3
      );
      expect(block).toBeDefined();
      expect(block?.message).toContain('ซ้ำกับแถวที่ 2');
    });

    it('ผ่านเมื่อเลขที่เอกสารเดียวกันแต่ revision ต่างกัน', async () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          documentNumber: 'DOC-001',
          revisionNumber: '0',
        }),
        makeRow({
          rowIndex: 3,
          documentNumber: 'DOC-001',
          revisionNumber: '1',
        }),
      ];

      const result = await service.validate({
        rows,
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const dup = result.findings.find(
        (f) => f.level === 'BLOCK' && f.message.includes('ซ้ำกับแถว')
      );
      expect(dup).toBeUndefined();
    });
  });

  describe('duplicate doc number + revision ใน DB', () => {
    it('BLOCK เมื่อเลขที่เอกสาร + revision มีอยู่แล้วใน DB', async () => {
      corrRepo.find.mockResolvedValue([
        {
          id: 10,
          correspondenceNumber: 'DOC-001',
          revisions: [{ revisionNumber: 0 }],
        } as Partial<Correspondence> as Correspondence,
      ]);

      const result = await service.validate({
        rows: [makeRow({ documentNumber: 'DOC-001', revisionNumber: '0' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) =>
          f.level === 'BLOCK' && f.message.includes('มีอยู่แล้วในฐานข้อมูล')
      );
      expect(block).toBeDefined();
    });

    it('ผ่านเมื่อเลขที่เอกสารเดิม + revision ใหม่ (FR-007)', async () => {
      corrRepo.find.mockResolvedValue([
        {
          id: 10,
          correspondenceNumber: 'DOC-001',
          revisions: [{ revisionNumber: 0 }],
        } as Partial<Correspondence> as Correspondence,
      ]);

      const result = await service.validate({
        rows: [makeRow({ documentNumber: 'DOC-001', revisionNumber: '1' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) =>
          f.level === 'BLOCK' && f.message.includes('มีอยู่แล้วในฐานข้อมูล')
      );
      expect(block).toBeUndefined();
    });
  });

  describe('organization resolution (FR-006)', () => {
    it('BLOCK ใน DIRECT_IMPORT เมื่อหน่วยงานไม่ตรง Master', async () => {
      orgRepo.find.mockResolvedValue([]);

      const result = await service.validate({
        rows: [makeRow({ senderOrgRaw: 'หน่วยงานปลอม' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.column === 'From'
      );
      expect(block).toBeDefined();
      expect(block?.message).toContain('Direct Import บังคับ');
    });

    it('WARN ใน MIGRATION_STAGING เมื่อหน่วยงานไม่ตรง Master', async () => {
      orgRepo.find.mockResolvedValue([]);

      const result = await service.validate({
        rows: [makeRow({ senderOrgRaw: 'หน่วยงานปลอม' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'MIGRATION_STAGING',
        attachmentFileNames: [],
      });

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'From'
      );
      expect(warn).toBeDefined();
      expect(warn?.message).toContain('Migration Staging อนุญาต');
    });

    it('resolve senderOrgId เมื่อเจอ exact match', async () => {
      orgRepo.find.mockResolvedValue([
        {
          id: 5,
          organizationName: 'สำนักงานใหญ่',
          organizationCode: 'HQ',
        } as Partial<Organization> as Organization,
      ]);

      const result = await service.validate({
        rows: [makeRow({ senderOrgRaw: 'สำนักงานใหญ่' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      expect(result.rows[0].senderOrgId).toBe(5);
      const warn = result.findings.find((f) => f.column === 'From');
      expect(warn).toBeUndefined();
    });
  });

  describe('type/discipline resolution', () => {
    it('WARN เมื่อ typeCode ไม่ตรง Master', async () => {
      typeRepo.find.mockResolvedValue([]);

      const result = await service.validate({
        rows: [makeRow({ correspondenceTypeCode: 'UNKNOWN' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'Category'
      );
      expect(warn).toBeDefined();
    });

    it('WARN เมื่อ disciplineCode ไม่ตรง Master', async () => {
      disciplineRepo.find.mockResolvedValue([]);

      const result = await service.validate({
        rows: [makeRow({ disciplineCode: 'UNKNOWN' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'Discipline'
      );
      expect(warn).toBeDefined();
    });
  });

  describe('chronology guard (FR-005)', () => {
    it('BLOCK เมื่อ issued > received', async () => {
      const result = await service.validate({
        rows: [
          makeRow({
            issuedDate: new Date('2025-08-16'),
            receivedDate: new Date('2025-08-15'),
          }),
        ],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) => f.level === 'BLOCK' && f.column === 'Date'
      );
      expect(block).toBeDefined();
      expect(block?.message).toContain('ลำดับวันที่ขัดแย้ง');
    });

    it('ผ่านเมื่อ issued <= received', async () => {
      const result = await service.validate({
        rows: [
          makeRow({
            issuedDate: new Date('2025-08-15'),
            receivedDate: new Date('2025-08-16'),
          }),
        ],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const dateBlock = result.findings.find(
        (f) => f.column === 'Date' && f.level === 'BLOCK'
      );
      expect(dateBlock).toBeUndefined();
    });

    it('BLOCK เมื่อ received เกิน NOW+1 วัน (future date guard)', async () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const result = await service.validate({
        rows: [
          makeRow({
            issuedDate: new Date('2025-08-15'),
            receivedDate: future,
          }),
        ],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const block = result.findings.find(
        (f) => f.column === 'Date' && f.level === 'BLOCK'
      );
      expect(block).toBeDefined();
    });
  });

  describe('attachment filename matching (D9)', () => {
    it('WARN เมื่อระบุ fileName แต่ไม่ส่งไฟล์มา', async () => {
      const result = await service.validate({
        rows: [makeRow({ fileName: 'missing.pdf' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const warn = result.findings.find(
        (f) => f.level === 'WARN' && f.column === 'File Name'
      );
      expect(warn).toBeDefined();
      expect(warn?.message).toContain('ไม่พบไฟล์ในแพ็กเกจ');
    });

    it('ผ่านเมื่อ fileName ตรงกับ attachment ที่ส่งมา', async () => {
      const result = await service.validate({
        rows: [makeRow({ fileName: 'doc1.pdf' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: ['doc1.pdf'],
      });

      const warn = result.findings.find((f) => f.column === 'File Name');
      expect(warn).toBeUndefined();
    });

    it('ผ่านเมื่อ fileName ว่าง (ลงทะเบียนล่วงหน้าไม่มีไฟล์แนบ)', async () => {
      const result = await service.validate({
        rows: [makeRow({ fileName: '' })],
        projectPublicId: 'proj-uuid-1',
        targetMode: 'DIRECT_IMPORT',
        attachmentFileNames: [],
      });

      const warn = result.findings.find((f) => f.column === 'File Name');
      expect(warn).toBeUndefined();
    });
  });
});
