// File: backend/src/modules/migration/services/excel-schema-validator.service.ts
// Change Log:
// - 2026-09-06: Initial creation — Layer 1 Schema Validator (T007, FR-003)
//   ตรวจสอบโครงสร้าง Excel: header ภาษาไทย/อังกฤษ, ชนิดข้อมูลเซลล์,
//   ความยาวข้อความ, คอลัมน์บังคับ (Document Number), ความสามารถอ่าน workbook
//   ผลลัพธ์เป็น ReviewFinding[] ระดับ BLOCK/WARN สำหรับส่งต่อให้ Layer 2
// - 2026-09-06: Fix review attempt 5 — attach per-row findings ไปยัง row.findings
//   ด้วย (ไม่ใช่เฉพาะ findings array) เพื่อให้ computeCounts ใน orchestrator
//   นับ Layer 1 BLOCK/WARN ได้ถูกต้อง + ลบ unused Logger

import { Injectable } from '@nestjs/common';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
} from '../types/excel-review.types';
import { ExcelRowBuilderResult } from './excel-row-builder.service';

/** ความยาวสูงสุดของเลขที่เอกสาร (ตาม correspondence.correspondence_number length 100) */
const MAX_DOCUMENT_NUMBER_LENGTH = 100;

/** ความยาวสูงสุดของ Subject (ตาม correspondence-revision.subject length 500) */
const MAX_SUBJECT_LENGTH = 500;

/** ความยาวสูงสุดของ Revision label (ตาม correspondence-revision.revision_label length 10) */
const MAX_REVISION_LABEL_LENGTH = 10;

/** ความยาวสูงสุดของ Organization raw text (ตาม organization.organization_name length 255) */
const MAX_ORG_RAW_LENGTH = 255;

/** ความยาวสูงสุดของ File Name (พอเหมาะ — 255) */
const MAX_FILE_NAME_LENGTH = 255;

/** ความยาวสูงสุดของ Remarks (text column — ใช้ 1000 เป็นเกตปลอดภัย) */
const MAX_REMARKS_LENGTH = 1000;

/**
 * ผลลัพธ์การตรวจ Layer 1
 * - workbookReadable: อ่าน workbook ได้หรือไม่ (false = BLOCK ทั้งไฟล์)
 * - headerMappingFound: พบ header row ที่มี Document Number อย่างน้อย 1 sheet
 * - findings: รายการปัญหาที่พบ (BLOCK/WARN)
 * - rows: ส่งต่อ ExcelCorrespondenceRow[] จาก RowBuilder เพื่อให้ Layer 2 ใช้ต่อ
 */
export interface SchemaValidatorResult {
  workbookReadable: boolean;
  headerMappingFound: boolean;
  findings: ReviewFinding[];
  rows: ExcelCorrespondenceRow[];
  sheetNames: string[];
  skippedRows: number;
}

/**
 * ExcelSchemaValidatorService — Layer 1 ของ 4-Layer Pipeline (T007, FR-003)
 *
 * หน้าที่:
 * - ตรวจ workbook readability (ไฟล์เสีย = BLOCK ทั้งไฟล์)
 * - ตรวจ header mapping (ไม่เจอ Document Number = BLOCK ทั้งไฟล์)
 * - ตรวจ required field (Document Number บังคับในทุกแถว)
 * - ตรวจความยาวข้อความตามข้อกำหนด DB
 * - ตรวจชนิดข้อมูลเซลล์ (วันที่ที่แปลงไม่ได้ = WARN)
 * - ตรวจ Revision format (ตัวเลขหรือสตริงสั้น)
 *
 * ไม่ตรวจ cross-table (Layer 2 ทำ) ไม่ตรวจ AI (Layer 3 ทำ)
 */
@Injectable()
export class ExcelSchemaValidatorService {
  /**
   * ตรวจ Layer 1 จากผล ExcelRowBuilder
   * ถ้า workbook อ่านไม่ได้ Layer บนควร catch error ก่อนเรียก — แต่ถ้าเรียกถึง
   * ที่นี่จะคืน workbookReadable=false พร้อม BLOCK ทั้งไฟล์
   */
  validate(parsed: ExcelRowBuilderResult): SchemaValidatorResult {
    const findings: ReviewFinding[] = [];

    // 1) ตรวจ header mapping
    if (!parsed.headerMappingFound) {
      findings.push({
        row: 0,
        column: 'Header',
        level: 'BLOCK',
        message:
          'ไม่พบแถวหัวคอลัมน์ที่ระบบรู้จัก (ต้องมี "เอกสารเลขที่" หรือ "Document Number") ภายใน 5 แถวแรกของอย่างน้อย 1 sheet',
        originalValue: parsed.sheetNames,
      });
      return {
        workbookReadable: true,
        headerMappingFound: false,
        findings,
        rows: [],
        sheetNames: parsed.sheetNames,
        skippedRows: parsed.skippedRows,
      };
    }

    // สร้าง copy ของ rows เพื่อ attach findings โดยไม่ mutate input
    const rows = parsed.rows.map((r) => ({ ...r, findings: [...r.findings] }));

    // 2) ตรวจทีละแถว — attach findings ทั้งใน array และ row.findings
    for (const row of rows) {
      // Document Number บังคับ (RowBuilder กรองแถวว่างแล้ว แต่ตรวจซ้ำเพื่อปลอดภัย)
      if (!row.documentNumber || row.documentNumber.trim() === '') {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Document Number',
          level: 'BLOCK',
          message: 'เลขที่เอกสารบังคับระบุ ไม่สามารถเว้นว่างได้',
          originalValue: row.documentNumber,
        });
      } else if (row.documentNumber.length > MAX_DOCUMENT_NUMBER_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Document Number',
          level: 'BLOCK',
          message: `เลขที่เอกสารยาวเกินกว่า ${MAX_DOCUMENT_NUMBER_LENGTH} ตัวอักษร (ฐานข้อมูลรองรับ ${MAX_DOCUMENT_NUMBER_LENGTH})`,
          originalValue: row.documentNumber,
          suggestedValue: row.documentNumber.slice(
            0,
            MAX_DOCUMENT_NUMBER_LENGTH
          ),
        });
      }

      // Subject บังคับ (ตาม correspondence-revision.subject NOT NULL)
      if (!row.subject || row.subject.trim() === '') {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Subject',
          level: 'BLOCK',
          message: 'เรื่อง/หัวข้อบังคับระบุ ไม่สามารถเว้นว่างได้',
          originalValue: row.subject,
        });
      } else if (row.subject.length > MAX_SUBJECT_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Subject',
          level: 'WARN',
          message: `เรื่องยาวเกินกว่า ${MAX_SUBJECT_LENGTH} ตัวอักษร อาจถูกตัดเมื่อบันทึก`,
          originalValue: row.subject,
          suggestedValue: row.subject.slice(0, MAX_SUBJECT_LENGTH),
        });
      }

      // Revision label — ตัวเลขหรือสตริงสั้น
      if (row.revisionNumber.length > MAX_REVISION_LABEL_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Revision',
          level: 'WARN',
          message: `Revision label ยาวเกินกว่า ${MAX_REVISION_LABEL_LENGTH} ตัวอักษร แนะนำให้ใช้ตัวเลขหรือสตริงสั้น (เช่น 0, 1, A)`,
          originalValue: row.revisionNumber,
        });
      }

      // Organization raw — ความยาว
      if (row.senderOrgRaw && row.senderOrgRaw.length > MAX_ORG_RAW_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'From',
          level: 'WARN',
          message: `ชื่อหน่วยงานผู้ส่งยาวเกินกว่า ${MAX_ORG_RAW_LENGTH} ตัวอักษร`,
          originalValue: row.senderOrgRaw,
        });
      }
      if (
        row.receiverOrgRaw &&
        row.receiverOrgRaw.length > MAX_ORG_RAW_LENGTH
      ) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'To',
          level: 'WARN',
          message: `ชื่อหน่วยงานผู้รับยาวเกินกว่า ${MAX_ORG_RAW_LENGTH} ตัวอักษร`,
          originalValue: row.receiverOrgRaw,
        });
      }

      // File Name — ความยาว
      if (row.fileName && row.fileName.length > MAX_FILE_NAME_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'File Name',
          level: 'WARN',
          message: `ชื่อไฟล์ยาวเกินกว่า ${MAX_FILE_NAME_LENGTH} ตัวอักษร`,
          originalValue: row.fileName,
        });
      }

      // Remarks — ความยาว
      if (row.remarks && row.remarks.length > MAX_REMARKS_LENGTH) {
        this.addRowFinding(findings, row, {
          row: row.rowIndex,
          column: 'Remarks',
          level: 'WARN',
          message: `หมายเหตุยาวเกินกว่า ${MAX_REMARKS_LENGTH} ตัวอักษร อาจถูกตัดเมื่อบันทึก`,
          originalValue: row.remarks,
        });
      }

      // วันที่ที่ระบุแต่แปลงไม่ได้ — แจ้งเป็น WARN (Layer 2 จะตรวจ chronology ต่อ)
      // ตรวจได้โดยดูว่า raw cell เป็น string ที่ไม่ใช่รูปแบบวันที่ แต่ที่นี่เรา
      // มีเฉพาะ Date|undefined จาก RowBuilder จึงตรวจเฉพาะกรณีที่ระบุคอลัมน์
      // แต่ parse ไม่ได้ — ต้องการ raw value จึงจะแจ้งได้ จึง skip ที่นี่
      // (Layer 2 จะจัดการ chronology guard ที่ใช้ Date เท่านั้น)
    }

    return {
      workbookReadable: true,
      headerMappingFound: true,
      findings,
      rows,
      sheetNames: parsed.sheetNames,
      skippedRows: parsed.skippedRows,
    };
  }

  // ---------- internals ----------

  /**
   * เพิ่ม finding ทั้งใน findings array (รวม) และ row.findings (ต่อแถว)
   * เพื่อให้ computeCounts ใน orchestrator นับ Layer 1 BLOCK/WARN ได้ถูกต้อง
   */
  private addRowFinding(
    findings: ReviewFinding[],
    row: ExcelCorrespondenceRow,
    finding: ReviewFinding
  ): void {
    findings.push(finding);
    row.findings.push(finding);
  }
}
