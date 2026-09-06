// File: backend/src/modules/migration/services/excel-annotator.service.spec.ts
// Test for ExcelAnnotatorService (T016, FR-010, D4)

import { Test } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as ExcelJS from 'exceljs';
import { ExcelAnnotatorService } from './excel-annotator.service';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewSummaryCounts,
} from '../types/excel-review.types';

describe('ExcelAnnotatorService', () => {
  let service: ExcelAnnotatorService;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'annotator-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ExcelAnnotatorService],
    }).compile();
    service = moduleRef.get(ExcelAnnotatorService);
  });

  function makeRow(
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow {
    return {
      rowIndex: 2,
      documentNumber: 'DOC-001',
      subject: 'Test Subject',
      revisionNumber: '0',
      issuedDate: new Date('2026-01-01'),
      receivedDate: new Date('2026-01-02'),
      senderOrgRaw: 'Org A',
      receiverOrgRaw: 'Org B',
      correspondenceTypeCode: 'LTR',
      disciplineCode: 'CIV',
      fileName: 'doc.pdf',
      remarks: '',
      findings: [],
      ...overrides,
    };
  }

  function makeCounts(
    overrides: Partial<ReviewSummaryCounts> = {}
  ): ReviewSummaryCounts {
    return {
      totalRows: 1,
      passCount: 1,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      canConfirm: true,
      ...overrides,
    };
  }

  it('สร้างไฟล์ .xlsx ได้และมี 2 Sheets (Review_Summary + Data)', async () => {
    const outputPath = path.join(tmpDir, 'test1.xlsx');
    const rows = [makeRow()];
    const counts = makeCounts();
    const findings: ReviewFinding[] = [];

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows,
      counts,
      findings,
      outputPath,
    });

    // ตรวจว่าไฟล์มีอยู่
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(0);

    // อ่าน workbook ตรวจ sheets
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain('Review_Summary');
    expect(sheetNames).toContain('Data');
  });

  it('Sheet Review_Summary แสดงตัวเลขสรุปถูกต้อง', async () => {
    const outputPath = path.join(tmpDir, 'test2.xlsx');
    const counts = makeCounts({
      totalRows: 10,
      passCount: 7,
      warnCount: 2,
      blockCount: 1,
      aiSuggestCount: 3,
      canConfirm: false,
    });

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow()],
      counts,
      findings: [],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const summary = wb.getWorksheet('Review_Summary');
    expect(summary).toBeDefined();
    expect(summary!.getCell('B3').value).toBe(10); // total
    expect(summary!.getCell('B4').value).toBe(7); // pass
    expect(summary!.getCell('B5').value).toBe(2); // warn
    expect(summary!.getCell('B6').value).toBe(1); // block
    expect(summary!.getCell('B7').value).toBe(3); // ai suggest
    expect(summary!.getCell('B8').value).toBe('No'); // canConfirm
  });

  it('Sheet Data มี header row รวม audit columns ([AI] prefix)', async () => {
    const outputPath = path.join(tmpDir, 'test3.xlsx');

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow()],
      counts: makeCounts(),
      findings: [],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    expect(data).toBeDefined();

    const headerRow = data!.getRow(1);
    const headers: string[] = [];
    for (let i = 1; i <= 14; i++) {
      const v = headerRow.getCell(i).value;
      headers.push(
        typeof v === 'string'
          ? v
          : typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : ''
      );
    }
    // 11 data columns + 3 audit columns
    expect(headers).toHaveLength(14);
    expect(headers[11]).toContain('[AI]');
    expect(headers[12]).toContain('[AI]');
    expect(headers[13]).toContain('[AI]');
  });

  it('ใส่สีแดงอ่อนสำหรับ BLOCK findings บนเซลล์ที่เกี่ยวข้อง', async () => {
    const outputPath = path.join(tmpDir, 'test4.xlsx');
    const blockFinding: ReviewFinding = {
      row: 2,
      column: 'document number',
      level: 'BLOCK',
      message: 'Duplicate document number',
      originalValue: 'DOC-001',
    };
    const rows = [makeRow({ findings: [blockFinding] })];

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows,
      counts: makeCounts({ blockCount: 1, canConfirm: false }),
      findings: [blockFinding],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    const cell = data!.getRow(2).getCell(1); // document number column
    expect(cell.fill?.type).toBe('pattern');
    // ตรวจสี (argb format)
    const fill = cell.fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe('FFFCE4D6'); // light red
  });

  it('ใส่สีเหลืองอ่อนสำหรับ WARN findings', async () => {
    const outputPath = path.join(tmpDir, 'test5.xlsx');
    const warnFinding: ReviewFinding = {
      row: 2,
      column: 'subject',
      level: 'WARN',
      message: 'Subject too long',
      originalValue: 'Long subject...',
    };
    const rows = [makeRow({ findings: [warnFinding] })];

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows,
      counts: makeCounts({ warnCount: 1 }),
      findings: [warnFinding],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    const cell = data!.getRow(2).getCell(2); // subject column
    const fill = cell.fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe('FFFFF2CC'); // light yellow
  });

  it('ฝัง Cell Comment บนเซลล์ที่มี finding', async () => {
    const outputPath = path.join(tmpDir, 'test6.xlsx');
    const finding: ReviewFinding = {
      row: 2,
      column: 'document number',
      level: 'BLOCK',
      message: 'Required field missing',
      originalValue: '',
    };

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow({ findings: [finding] })],
      counts: makeCounts({ blockCount: 1, canConfirm: false }),
      findings: [finding],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    const cell = data!.getRow(2).getCell(1);
    expect(cell.note).toBeDefined();
    // ExcelJS may store note as string or as Comment object after read
    const note = cell.note;
    const noteText =
      typeof note === 'string'
        ? note
        : (note?.texts?.map((t: { text: string }) => t.text).join('') ?? '');
    expect(noteText).toContain('Required field missing');
  });

  it('เขียน AI_SUGGEST ลงใน audit columns ([AI] Suggested Type)', async () => {
    const outputPath = path.join(tmpDir, 'test7.xlsx');
    const aiSuggestion: ReviewFinding = {
      row: 2,
      column: 'AI Review',
      level: 'AI_SUGGEST',
      message: 'Suggest type RFA',
      originalValue: undefined,
      suggestedValue: { type: 'RFA', discipline: 'CIV' },
      confidence: 0.92,
    };

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow({ findings: [aiSuggestion] })],
      counts: makeCounts({ aiSuggestCount: 1 }),
      findings: [aiSuggestion],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    const typeCell = data!.getRow(2).getCell(13); // [AI] Suggested Type
    expect(typeCell.value).toBe('RFA');

    const notesCell = data!.getRow(2).getCell(14); // [AI] Review Notes
    const notesRaw = notesCell.value ?? '';
    const notesValue =
      typeof notesRaw === 'string'
        ? notesRaw
        : typeof notesRaw === 'number' || typeof notesRaw === 'boolean'
          ? String(notesRaw)
          : '';
    expect(notesValue).toContain('AI_SUGGEST');
    expect(notesValue).toContain('Suggest type RFA');
  });

  it('เขียน AI_SUGGEST ลงใน [AI] Suggested Subject จาก suggestedValue.subject', async () => {
    const outputPath = path.join(tmpDir, 'test7b.xlsx');
    const aiSuggestion: ReviewFinding = {
      row: 2,
      column: 'AI Review',
      level: 'AI_SUGGEST',
      message: 'Suggest subject correction',
      originalValue: undefined,
      suggestedValue: { subject: 'แจ้งเรื่อง RFA ฉบับแก้ไข', type: 'RFA' },
      confidence: 0.88,
    };

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow({ findings: [aiSuggestion] })],
      counts: makeCounts({ aiSuggestCount: 1 }),
      findings: [aiSuggestion],
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const data = wb.getWorksheet('Data');
    const subjectCell = data!.getRow(2).getCell(12); // [AI] Suggested Subject
    expect(subjectCell.value).toBe('แจ้งเรื่อง RFA ฉบับแก้ไข');
  });

  it('Key Findings table เรียงตามระดับ BLOCK > WARN > AI_SUGGEST', async () => {
    const outputPath = path.join(tmpDir, 'test8.xlsx');
    const findings: ReviewFinding[] = [
      {
        row: 3,
        column: 'x',
        level: 'AI_SUGGEST',
        message: 'ai 1',
        originalValue: '',
      },
      {
        row: 2,
        column: 'x',
        level: 'BLOCK',
        message: 'block 1',
        originalValue: '',
      },
      {
        row: 4,
        column: 'x',
        level: 'WARN',
        message: 'warn 1',
        originalValue: '',
      },
    ];

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow()],
      counts: makeCounts(),
      findings,
      outputPath,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const summary = wb.getWorksheet('Review_Summary');
    // Row 12 = first finding (after header at 11)
    expect(summary!.getRow(12).getCell(3).value).toBe('BLOCK');
    expect(summary!.getRow(13).getCell(3).value).toBe('WARN');
    expect(summary!.getRow(14).getCell(3).value).toBe('AI_SUGGEST');
  });

  it('สร้างไฟล์ใน path ที่ยังไม่มี directory ได้ (recursive mkdir)', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'sub', 'dir');
    const outputPath = path.join(nestedDir, 'test9.xlsx');

    await service.generateAnnotated({
      originalFilePath: outputPath,
      rows: [makeRow()],
      counts: makeCounts(),
      findings: [],
      outputPath,
    });

    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
