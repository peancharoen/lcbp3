// File: backend/src/modules/migration/services/excel-row-builder.service.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ ExcelRowBuilderService
//   (T006, FR-002 single parser + FR-011 [AI] column exclusion) ตาม TDD RED
//   ก่อน implement — ใช้ ExcelJS เขียน workbook จริงลง tmpdir เพื่อ test แบบ hermetic

import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExcelRowBuilderService } from './excel-row-builder.service';
import { ExcelDateParserService } from './excel-date-parser.service';
import { ANNOTATED_AUDIT_COLUMN_PREFIX } from '../types/excel-review.types';

interface SheetFixture {
  name: string;
  rows: unknown[][];
}

describe('ExcelRowBuilderService', () => {
  let service: ExcelRowBuilderService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'row-builder-spec-'));

    const module = await Test.createTestingModule({
      providers: [ExcelRowBuilderService, ExcelDateParserService],
    }).compile();

    service = module.get<ExcelRowBuilderService>(ExcelRowBuilderService);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** เขียน workbook จริงด้วย ExcelJS ลง tmpdir แล้วคืน path (แบบ hermetic) */
  const writeWorkbook = async (sheets: SheetFixture[]): Promise<string> => {
    const workbook = new ExcelJS.Workbook();
    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name);
      for (const rowValues of sheet.rows) {
        worksheet.addRow(rowValues);
      }
    }
    const filePath = path.join(
      tmpDir,
      `wb-${Date.now()}-${Math.floor(Math.random() * 1000000)}.xlsx`
    );
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  };

  const thaiHeaders = (): unknown[] => [
    'เอกสารเลขที่',
    'เรื่อง',
    'วันที่ออก',
    'วันที่รับ',
    'ผู้ส่ง',
    'ผู้รับ',
    'ประเภท',
    'ชื่อไฟล์',
    'หมายเหตุ',
    'revision',
    'discipline',
  ];

  describe('buildFromWorkbook — happy path ภาษาไทย', () => {
    it('map คอลัมน์ไทยครบทุก field ของ ExcelCorrespondenceRow', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            thaiHeaders(),
            [
              'NP-DMS-2025-001',
              'เรื่องทดสอบระบบ',
              '15/08/2568',
              '16/08/2568',
              'สำนักงานใหญ่',
              'ฝ่ายช่าง',
              'LTR',
              'file1.pdf',
              'หมายเหตุทดสอบ',
              '2',
              'CIV',
            ],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.headerMappingFound).toBe(true);
      expect(result.sheetNames).toEqual(['Sheet1']);
      expect(result.skippedRows).toBe(0);
      expect(result.rows).toHaveLength(1);

      const row = result.rows[0];
      expect(row.rowIndex).toBe(2);
      expect(row.documentNumber).toBe('NP-DMS-2025-001');
      expect(row.subject).toBe('เรื่องทดสอบระบบ');
      expect(row.correspondenceTypeCode).toBe('LTR');
      expect(row.disciplineCode).toBe('CIV');
      expect(row.revisionNumber).toBe('2');
      expect(row.senderOrgRaw).toBe('สำนักงานใหญ่');
      expect(row.receiverOrgRaw).toBe('ฝ่ายช่าง');
      expect(row.fileName).toBe('file1.pdf');
      expect(row.remarks).toBe('หมายเหตุทดสอบ');
      expect(row.findings).toEqual([]);
    });

    it('แปลงวันที่ พ.ศ. ผ่าน ExcelDateParserService (15/08/2568 → 2025-08-15)', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            thaiHeaders(),
            ['NP-DMS-2025-002', 'เรื่อง B.E.', '15/08/2568', '15 ส.ค. 2568'],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      const row = result.rows[0];
      expect(row.issuedDate?.getFullYear()).toBe(2025);
      expect(row.issuedDate?.getMonth()).toBe(7);
      expect(row.issuedDate?.getDate()).toBe(15);
      expect(row.receivedDate?.getFullYear()).toBe(2025);
      expect(row.receivedDate?.getMonth()).toBe(7);
      expect(row.receivedDate?.getDate()).toBe(15);
    });

    it('แปลง Excel serial number cell เป็น Date (45903 → 2025-09-03 UTC)', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            thaiHeaders(),
            ['NP-DMS-2025-003', 'เรื่อง Serial', 45903, 45904],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      const row = result.rows[0];
      expect(row.issuedDate?.getUTCFullYear()).toBe(2025);
      expect(row.issuedDate?.getUTCMonth()).toBe(8);
      expect(row.issuedDate?.getUTCDate()).toBe(3);
      expect(row.receivedDate?.getUTCDate()).toBe(4);
    });

    it('ตั้ง revisionNumber = "0" เมื่อไม่มีคอลัมน์ revision/discipline เลย', async () => {
      const headersWithoutRev = thaiHeaders().slice(0, 9);
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            headersWithoutRev,
            ['NP-DMS-2025-004', 'เรื่องไม่มี Rev', '15/08/2025', '16/08/2025'],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows[0].revisionNumber).toBe('0');
      expect(result.rows[0].disciplineCode).toBeUndefined();
    });

    it('ตั้ง revisionNumber = "0" เมื่อคอลัมน์ revision มีแต่ค่าว่าง', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            thaiHeaders(),
            [
              'NP-DMS-2025-005',
              'เรื่อง Rev ว่าง',
              '15/08/2025',
              '16/08/2025',
              'A',
              'B',
              'LTR',
              'f.pdf',
              '',
              '',
              '',
            ],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows[0].revisionNumber).toBe('0');
    });
  });

  describe('buildFromWorkbook — ภาษาอังกฤษ + การข้ามแถว', () => {
    it('map คอลัมน์ภาษาอังกฤษ (Document Number / Subject / Rev / Discipline)', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'EN',
          rows: [
            [
              'Document Number',
              'Subject',
              'Date of Issue',
              'Date Received',
              'From',
              'To',
              'Category',
              'File Name',
              'Remarks',
              'Rev',
              'Discipline',
            ],
            [
              'ENG-001',
              'Test Subject',
              '2025-08-15',
              '2025-08-16',
              'Org A',
              'Org B',
              'LTR',
              'eng.pdf',
              'note',
              '3',
              'MEC',
            ],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.headerMappingFound).toBe(true);
      const row = result.rows[0];
      expect(row.documentNumber).toBe('ENG-001');
      expect(row.subject).toBe('Test Subject');
      expect(row.issuedDate?.getFullYear()).toBe(2025);
      expect(row.receivedDate?.getFullYear()).toBe(2025);
      expect(row.senderOrgRaw).toBe('Org A');
      expect(row.receiverOrgRaw).toBe('Org B');
      expect(row.correspondenceTypeCode).toBe('LTR');
      expect(row.fileName).toBe('eng.pdf');
      expect(row.remarks).toBe('note');
      expect(row.revisionNumber).toBe('3');
      expect(row.disciplineCode).toBe('MEC');
    });

    it('ข้ามแถวที่ไม่มีเลขที่เอกสารและนับใน skippedRows', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            thaiHeaders(),
            ['NP-DMS-2025-010', 'เรื่องแรก', '15/08/2025', '16/08/2025'],
            [null, 'แถวไม่มีเลขที่', '15/08/2025', '16/08/2025'],
            ['   ', 'แถวเลขที่เป็นช่องว่าง', '15/08/2025', '16/08/2025'],
            ['NP-DMS-2025-011', 'เรื่องหลัง', '15/08/2025', '16/08/2025'],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(2);
      expect(result.skippedRows).toBe(2);
      expect(result.rows.map((r) => r.documentNumber)).toEqual([
        'NP-DMS-2025-010',
        'NP-DMS-2025-011',
      ]);
    });
  });

  describe('buildFromWorkbook — ตรวจจับ header อัตโนมัติ', () => {
    it('เจอ header ที่ไม่ใช่แถวแรก (มีแถวหัวเรื่องขึ้นก่อน)', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            ['ทะเบียนเอกสารรายเดือน ประจำปีงบประมาณ'],
            thaiHeaders(),
            [
              'NP-DMS-2025-020',
              'เรื่องหลัง header แถวที่ 2',
              '15/08/2025',
              '16/08/2025',
            ],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.headerMappingFound).toBe(true);
      expect(result.rows).toHaveLength(1);
      // rowIndex = หมายเลขแถวจริงใน worksheet (แถวที่ 3)
      expect(result.rows[0].rowIndex).toBe(3);
      expect(result.rows[0].subject).toBe('เรื่องหลัง header แถวที่ 2');
    });

    it('headerMappingFound = false เมื่อไม่เจอ header ภายใน 5 แถวแรก', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Junk',
          rows: [
            ['aaa', 'bbb'],
            ['ccc', 'ddd'],
            ['eee', 'fff'],
            ['ggg', 'hhh'],
            ['iii', 'jjj'],
            ['kkk', 'lll'],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.headerMappingFound).toBe(false);
      expect(result.rows).toEqual([]);
      expect(result.skippedRows).toBe(0);
      expect(result.sheetNames).toEqual(['Junk']);
    });

    it('รวมหลาย sheet: sheetNames ครบทุก sheet, rows รวมจาก sheet ที่มี header', async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Data1',
          rows: [
            thaiHeaders(),
            ['NP-DMS-2025-030', 'เรื่อง sheet 1', '15/08/2025', '16/08/2025'],
          ],
        },
        {
          name: 'Data2',
          rows: [
            thaiHeaders(),
            ['NP-DMS-2025-031', 'เรื่อง sheet 2', '15/08/2025', '16/08/2025'],
          ],
        },
        {
          name: 'Junk',
          rows: [
            ['xxx', 'yyy'],
            ['zzz', 'www'],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.sheetNames).toEqual(['Data1', 'Data2', 'Junk']);
      expect(result.headerMappingFound).toBe(true);
      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((r) => r.documentNumber)).toEqual([
        'NP-DMS-2025-030',
        'NP-DMS-2025-031',
      ]);
    });
  });

  describe('buildFromWorkbook — คอลัมน์ [AI] (FR-011)', () => {
    it(`เพิกเฉยคอลัมน์ที่ขึ้นต้นด้วย "${ANNOTATED_AUDIT_COLUMN_PREFIX}" ทั้งหมด`, async () => {
      const filePath = await writeWorkbook([
        {
          name: 'Sheet1',
          rows: [
            [
              'เอกสารเลขที่',
              'เรื่อง',
              `${ANNOTATED_AUDIT_COLUMN_PREFIX} Suggested Subject`,
              `${ANNOTATED_AUDIT_COLUMN_PREFIX} วันที่รับ`,
              'วันที่รับ',
            ],
            [
              'DOC-001',
              'หัวข้อจริงจากผู้ใช้',
              'AI suggested subject',
              '01/01/1999',
              '16/08/2025',
            ],
          ],
        },
      ]);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(1);
      // subject ต้องมาจากคอลัมน์จริง ไม่ใช่คอลัมน์ [AI]
      expect(result.rows[0].subject).toBe('หัวข้อจริงจากผู้ใช้');
      // receivedDate ต้องมาจากคอลัมน์ "วันที่รับ" จริง (คอลัมน์ [AI] วันที่รับ ถูกเพิกเฉย)
      expect(result.rows[0].receivedDate?.getFullYear()).toBe(2025);
      expect(result.rows[0].receivedDate?.getMonth()).toBe(7);
      expect(result.rows[0].receivedDate?.getDate()).toBe(16);
    });
  });

  describe('buildFromWorkbook — error path', () => {
    it('throw error เมื่อไฟล์ไม่มีอยู่ (ให้ Layer บนจัดการต่อ)', async () => {
      const missingPath = path.join(tmpDir, 'no-such-file.xlsx');
      await expect(service.buildFromWorkbook(missingPath)).rejects.toThrow();
    });
  });

  // ─── Phase 2 Coverage Gap Tests ──────────────────────────────────────────

  describe('buildFromWorkbook — edge cases สำหรับ branch coverage', () => {
    it('ควรข้ามแถวที่ว่างเปล่าทั้งหมดโดยไม่นับเป็น skipped', async () => {
      const filePath = path.join(tmpDir, 'empty-rows.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow([
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
      ws.addRow([
        'DOC-001',
        'Test',
        '2024-01-01',
        '2024-01-02',
        'A',
        'B',
        '',
        '',
        '',
      ]);
      ws.addRow(['', '', '', '', '', '', '', '', '']); // แถวว่างเปล่า
      ws.addRow(['', '', '', '', '', '', '', '', '']); // แถวว่างเปล่า
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(1);
      // empty rows ไม่นับเป็น skipped
      expect(result.skippedRows).toBe(0);
    });

    it('ควรอ่าน cell ที่เป็น number ได้ (readCellAsString number path)', async () => {
      const filePath = path.join(tmpDir, 'numeric-cell.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['เลขที่เอกสาร', 'เรื่อง']);
      ws.addRow([12345, 'Numeric doc number']);
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].documentNumber).toBe('12345');
    });

    it('ควรอ่าน cell ที่เป็น hyperlink object ได้', async () => {
      const filePath = path.join(tmpDir, 'hyperlink-cell.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['เลขที่เอกสาร', 'เรื่อง']);
      const row = ws.addRow(['', 'Hyperlink test']);
      // ตั้งค่า cell เป็น hyperlink object
      row.getCell(1).value = {
        text: 'DOC-HYPERLINK-001',
        hyperlink: 'http://example.com/doc',
      } as unknown as string;
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].documentNumber).toBe('DOC-HYPERLINK-001');
    });

    it('ควรอ่าน cell ที่เป็น RichText ได้', async () => {
      const filePath = path.join(tmpDir, 'richtext-cell.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['เลขที่เอกสาร', 'เรื่อง']);
      const row = ws.addRow(['', 'RichText test']);
      // ตั้งค่า cell เป็น RichText
      row.getCell(1).value = {
        richText: [{ text: 'DOC-RICH-' }, { text: '001' }],
      } as unknown as string;
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].documentNumber).toBe('DOC-RICH-001');
    });

    it('ควรไม่อ่าน cell ที่เป็น boolean (return undefined)', async () => {
      const filePath = path.join(tmpDir, 'boolean-cell.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['เลขที่เอกสาร', 'เรื่อง']);
      const row = ws.addRow(['', 'Boolean test']);
      row.getCell(1).value = true as unknown as string;
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      // boolean cell → readCellAsString returns undefined → แถวถูกข้ามเป็น skipped
      expect(result.rows).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
    });

    it('ควรไม่อ่าน cell ที่เป็น Date ใน documentNumber (return undefined)', async () => {
      const filePath = path.join(tmpDir, 'date-cell.xlsx');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['เลขที่เอกสาร', 'เรื่อง']);
      const row = ws.addRow(['', 'Date test']);
      row.getCell(1).value = new Date('2024-06-15') as unknown as string;
      await wb.xlsx.writeFile(filePath);

      const result = await service.buildFromWorkbook(filePath);

      // Date cell → readCellAsString returns undefined → แถวถูกข้าม
      expect(result.skippedRows).toBe(1);
    });
  });
});
