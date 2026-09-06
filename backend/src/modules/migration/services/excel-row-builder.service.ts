// File: backend/src/modules/migration/services/excel-row-builder.service.ts
// Change Log:
// - 2026-09-06: Initial creation — ExcelRowBuilderService (T006, FR-002, FR-011)
//   ทำหน้าที่ parse Excel workbook เป็น ExcelCorrespondenceRow[] มาตรฐาน
//   เป็น single parser ที่ใช้ร่วมกันทั้งขั้นตอน Check และ Commit (FR-002)
//   เพิกเฉยคอลัมน์ที่ขึ้นต้นด้วย [AI] อัตโนมัติเมื่อ Re-upload (FR-011)
//   รองรับ header ทั้งภาษาไทยและอังกฤษ และตรวจจับ header ภายใน 5 แถวแรก

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExcelCorrespondenceRow } from '../types/excel-review.types';
import { ANNOTATED_AUDIT_COLUMN_PREFIX } from '../types/excel-review.types';
import { ExcelDateParserService } from './excel-date-parser.service';

/** จำนวนแถวสูงสุดที่จะสแกนหา header row */
const HEADER_SCAN_MAX_ROWS = 5;

/** ค่า revision เริ่มต้นเมื่อไม่ระบุ (D10) */
const DEFAULT_REVISION = '0';

/**
 * ผลลัพธ์การ parse workbook
 * - headerMappingFound: เจอ header row ที่มี field หลัก (Document Number) อย่างน้อย 1 sheet
 * - sheetNames: ชื่อทุก sheet ใน workbook (ตามลำดับ)
 * - skippedRows: จำนวนแถวที่ข้ามเพราะไม่มีเลขที่เอกสาร
 * - rows: แถวข้อมูลมาตรฐานจากทุก sheet ที่เจอ header
 */
export interface ExcelRowBuilderResult {
  headerMappingFound: boolean;
  sheetNames: string[];
  skippedRows: number;
  rows: ExcelCorrespondenceRow[];
}

/**
 * mapping ของคอลัมน์ใน sheet หนึ่ง ๆ
 * key = ชื่อ field ใน ExcelCorrespondenceRow, value = ดัชนีคอลัมน์ (0-based)
 * undefined = ไม่มีคอลัมน์นี้ใน sheet
 */
interface ColumnMapping {
  documentNumber?: number;
  subject?: number;
  issuedDate?: number;
  receivedDate?: number;
  senderOrg?: number;
  receiverOrg?: number;
  correspondenceType?: number;
  fileName?: number;
  remarks?: number;
  revision?: number;
  discipline?: number;
}

/**
 * alias ของชื่อคอลัมน์แต่ละ field — รวมภาษาไทยและอังกฤษ (ตัวพิมพ์เล็ก/ใหญ่ insensitive)
 * ไม่รวมคอลัมน์ที่ขึ้นต้นด้วย [AI] เพราะถูกกรองก่อน match
 */
const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  documentNumber: [
    'เอกสารเลขที่',
    'document number',
    'doc number',
    'doc no',
    'เลขที่เอกสาร',
    'เลขที่',
  ],
  subject: ['เรื่อง', 'subject', 'หัวข้อ', 'title'],
  issuedDate: [
    'วันที่ออก',
    'date of issue',
    'issued date',
    'issue date',
    'วันที่เอกสาร',
    'date issued',
  ],
  receivedDate: [
    'วันที่รับ',
    'date received',
    'received date',
    'วันรับ',
    'date of receipt',
  ],
  senderOrg: ['ผู้ส่ง', 'from', 'sender', 'หน่วยงานผู้ส่ง', 'org from'],
  receiverOrg: ['ผู้รับ', 'to', 'receiver', 'หน่วยงานผู้รับ', 'org to'],
  correspondenceType: [
    'ประเภท',
    'category',
    'type',
    'correspondence type',
    'ประเภทเอกสาร',
  ],
  fileName: ['ชื่อไฟล์', 'file name', 'filename', 'file', 'ไฟล์'],
  remarks: ['หมายเหตุ', 'remarks', 'remark', 'note', 'notes'],
  revision: ['revision', 'rev', 'ฉบับ', 'ครั้งที่'],
  discipline: ['discipline', 'วิชาการ', 'สาขา'],
};

/**
 * ExcelRowBuilderService — single parser กลางของ Pipeline (T006)
 *
 * หลักการสำคัญ (FR-002):
 * - ใช้ parser ตัวเดียวกันทั้ง Check และ Commit เพื่อป้องกันความคลาดเคลื่อนของตรรกะ
 * - ผลลัพธ์เป็น ExcelCorrespondenceRow[] ที่ Layer 1-3 ใช้ต่อ
 * - findings เริ่มต้นเป็น [] — Layer 1/2/3 เป็นผู้เติม finding ภายหลัง
 *
 * FR-011: เพิกเฉยคอลัมน์ที่ขึ้นต้นด้วย [AI] อัตโนมัติ
 * (ผู้ใช้ดาวน์โหลดไฟล์ annotated แล้วแก้ไขและ re-upload ได้โดยไม่กระทบการ parse)
 */
@Injectable()
export class ExcelRowBuilderService {
  private readonly logger = new Logger(ExcelRowBuilderService.name);

  constructor(private readonly dateParser: ExcelDateParserService) {}

  /**
   * parse workbook จาก path ของไฟล์ .xlsx
   * throw เมื่อไฟล์ไม่อ่านได้ (ให้ Layer บนจัดการต่อ)
   */
  async buildFromWorkbook(filePath: string): Promise<ExcelRowBuilderResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetNames: string[] = [];
    let headerMappingFound = false;
    let skippedRows = 0;
    const rows: ExcelCorrespondenceRow[] = [];

    workbook.eachSheet((sheet) => {
      sheetNames.push(sheet.name);

      const mapping = this.detectHeaderRow(sheet);
      if (!mapping) {
        // sheet นี้ไม่มี header ที่รู้จัก — ข้ามทั้ง sheet
        return;
      }

      headerMappingFound = true;
      const dataStartRow = mapping.headerRowNumber + 1;

      for (let r = dataStartRow; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const documentNumberCell = this.getCellByColIndex(
          row,
          mapping.columns.documentNumber
        );
        const documentNumber = this.readCellAsString(documentNumberCell);

        if (!documentNumber || documentNumber.trim() === '') {
          // ข้ามแถวที่ไม่มีเลขที่เอกสาร (นับเป็น skipped)
          // ยกเว้นแถวว่างเปล่าทั้งหมด — ไม่นับเป็น skipped
          if (this.isRowCompletelyEmpty(row, mapping.columns)) {
            continue;
          }
          skippedRows++;
          continue;
        }

        const built = this.buildRow(
          r,
          documentNumber.trim(),
          row,
          mapping.columns
        );
        rows.push(built);
      }
    });

    return {
      headerMappingFound,
      sheetNames,
      skippedRows,
      rows,
    };
  }

  // ---------- internals ----------

  /** ตรวจจับ header row ภายใน 5 แถวแรก คืน mapping หรือ undefined */
  private detectHeaderRow(
    sheet: ExcelJS.Worksheet
  ): { headerRowNumber: number; columns: ColumnMapping } | undefined {
    const scanLimit = Math.min(HEADER_SCAN_MAX_ROWS, sheet.rowCount);

    for (let r = 1; r <= scanLimit; r++) {
      const row = sheet.getRow(r);
      const columns = this.buildColumnMapping(row);
      // ต้องมีอย่างน้อย documentNumber ถึงจะถือว่าเป็น header
      if (columns.documentNumber !== undefined) {
        return { headerRowNumber: r, columns };
      }
    }

    return undefined;
  }

  /** สร้าง ColumnMapping จากแถวหนึ่ง (เทียบ alias และกรอง [AI] columns) */
  private buildColumnMapping(headerRow: ExcelJS.Row): ColumnMapping {
    const mapping: ColumnMapping = {};

    headerRow.eachCell((cell, colNumber) => {
      const headerText = this.readCellAsString(cell);
      if (!headerText) {
        return;
      }

      // กรองคอลัมน์ [AI] — เพิกเฉยทั้งหมด (FR-011)
      if (headerText.startsWith(ANNOTATED_AUDIT_COLUMN_PREFIX)) {
        return;
      }

      const normalized = headerText.trim().toLowerCase();
      (Object.keys(COLUMN_ALIASES) as (keyof ColumnMapping)[]).forEach(
        (field) => {
          if (mapping[field] !== undefined) {
            return; // ใช้คอลัมน์แรกที่เจอ
          }
          const aliases = COLUMN_ALIASES[field];
          if (aliases.some((a) => a.toLowerCase() === normalized)) {
            mapping[field] = colNumber - 1; // แปลง 1-based → 0-based
          }
        }
      );
    });

    return mapping;
  }

  /** สร้าง ExcelCorrespondenceRow จาก ExcelJS.Row */
  private buildRow(
    rowIndex: number,
    documentNumber: string,
    row: ExcelJS.Row,
    cols: ColumnMapping
  ): ExcelCorrespondenceRow {
    const subject = this.readCellAsString(
      this.getCellByColIndex(row, cols.subject)
    );
    const revisionRaw = this.readCellAsString(
      this.getCellByColIndex(row, cols.revision)
    );
    const revisionNumber =
      revisionRaw && revisionRaw.trim() !== ''
        ? revisionRaw.trim()
        : DEFAULT_REVISION;

    const issuedDateCell = this.getCellByColIndex(row, cols.issuedDate);
    const receivedDateCell = this.getCellByColIndex(row, cols.receivedDate);

    return {
      rowIndex,
      documentNumber,
      subject: subject ?? '',
      correspondenceTypeCode: this.readCellAsString(
        this.getCellByColIndex(row, cols.correspondenceType)
      ),
      disciplineCode: this.readCellAsString(
        this.getCellByColIndex(row, cols.discipline)
      ),
      revisionNumber,
      issuedDate: this.dateParser.parse(issuedDateCell?.value),
      receivedDate: this.dateParser.parse(receivedDateCell?.value),
      senderOrgRaw: this.readCellAsString(
        this.getCellByColIndex(row, cols.senderOrg)
      ),
      receiverOrgRaw: this.readCellAsString(
        this.getCellByColIndex(row, cols.receiverOrg)
      ),
      fileName: this.readCellAsString(
        this.getCellByColIndex(row, cols.fileName)
      ),
      remarks: this.readCellAsString(this.getCellByColIndex(row, cols.remarks)),
      findings: [],
    };
  }

  /** อ่าน cell ตาม 0-based column index (undefined ถ้าไม่มีคอลัมน์) */
  private getCellByColIndex(
    row: ExcelJS.Row,
    colIndex: number | undefined
  ): ExcelJS.Cell | undefined {
    if (colIndex === undefined) {
      return undefined;
    }
    // ExcelJS.getCell ใช้ 1-based
    return row.getCell(colIndex + 1);
  }

  /** อ่านค่า cell เป็น string ที่ trim แล้ว คืน undefined ถ้าว่าง */
  private readCellAsString(cell: ExcelJS.Cell | undefined): string | undefined {
    if (!cell) {
      return undefined;
    }
    const value = cell.value;
    if (value === null || value === undefined) {
      return undefined;
    }

    // กรณีเป็น string ตรง ๆ
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }

    // กรณีเป็น number
    if (typeof value === 'number') {
      return String(value);
    }

    // กรณีเป็น boolean
    if (typeof value === 'boolean') {
      return undefined;
    }

    // ExcelJS hyperlink object: { text, hyperlink }
    if (
      typeof value === 'object' &&
      value !== null &&
      'text' in value &&
      typeof (value as { text: unknown }).text === 'string'
    ) {
      const text = (value as { text: string }).text.trim();
      return text === '' ? undefined : text;
    }

    // ExcelJS RichText: { richText: [{ text: '...' }, ...] }
    if (
      typeof value === 'object' &&
      value !== null &&
      'richText' in value &&
      Array.isArray((value as { richText: unknown[] }).richText)
    ) {
      const richText = (value as { richText: { text?: string }[] }).richText;
      const combined = richText
        .map((rt) => (typeof rt.text === 'string' ? rt.text : ''))
        .join('');
      const trimmed = combined.trim();
      return trimmed === '' ? undefined : trimmed;
    }

    // กรณีเป็น Date — ไม่แปลงเป็น string ที่นี่ (dateParser จัดการเอง)
    if (value instanceof Date) {
      return undefined;
    }

    // กรณีอื่น ๆ — ไม่พยายาม String(value) เพราะอาจเป็น object ที่ไม่มี toString
    // ที่มีความหมาย (no-base-to-string) คืน undefined ปลอดภัยกว่า
    return undefined;
  }

  /** ตรวจว่าแถวว่างเปล่าทั้งหมด (ไม่มีค่าในคอลัมน์ที่รู้จัก) */
  private isRowCompletelyEmpty(row: ExcelJS.Row, cols: ColumnMapping): boolean {
    const fields: (number | undefined)[] = [
      cols.documentNumber,
      cols.subject,
      cols.issuedDate,
      cols.receivedDate,
      cols.senderOrg,
      cols.receiverOrg,
      cols.correspondenceType,
      cols.fileName,
      cols.remarks,
      cols.revision,
      cols.discipline,
    ];
    return fields.every((colIdx) => {
      if (colIdx === undefined) {
        return true;
      }
      const cell = this.getCellByColIndex(row, colIdx);
      const value = cell?.value;
      return value === null || value === undefined || value === '';
    });
  }
}
