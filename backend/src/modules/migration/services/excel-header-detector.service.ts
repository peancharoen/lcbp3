// File: backend/src/modules/migration/services/excel-header-detector.service.ts
// Change Log:
// - 2026-09-12: Initial creation — shared header detector (unify ADR-047 + ADR-052)
//   รวม header detection logic จาก LegacyIngestionService + ExcelRowBuilderService
//   ใช้ substring matching (header.includes(alias)) ตามแบบ LegacyIngestionService
//   ป้องกัน drift ระหว่าง /admin/migration และ /admin/import-review

import { Injectable } from '@nestjs/common';

/** จำนวนแถวสูงสุดที่จะสแกนหา header row */
export const HEADER_SCAN_MAX_ROWS = 5;

/**
 * field ทั้งหมดที่รองรับ — union ของ LegacyIngestionService + ExcelRowBuilderService
 * 1-based column index (ตาม ExcelJS convention)
 */
export type HeaderField =
  | 'documentNumber'
  | 'subject'
  | 'issuedDate'
  | 'receivedDate'
  | 'senderOrg'
  | 'receiverOrg'
  | 'correspondenceType'
  | 'correspondenceTypeId'
  | 'fileName'
  | 'remarks'
  | 'revision'
  | 'discipline';

/** mapping จาก field → 1-based column index (undefined = ไม่พบ) */
export type HeaderFieldMapping = Partial<Record<HeaderField, number>>;

/** pass หนึ่งของการ match — aliases + optional excludes/includes */
interface MatchPass {
  aliases: string[];
  /** header ต้องไม่มีคำเหล่านี้เป็น substring */
  excludes?: string[];
  /** header ต้องมีคำเหล่านี้ทุกคำเป็น substring */
  requires?: string[];
}

/** config ของแต่ละ field — มีได้หลาย pass (เรียงตามความสำคัญ จาก specific → generic) */
type FieldConfig = MatchPass[];

/**
 * alias รวมของทุก field — รวมจาก LegacyIngestionService + ExcelRowBuilderService
 * ใช้ substring matching (header.includes(alias)) ตามแบบ LegacyIngestionService
 *
 * การเรียง pass: specific ก่อน generic เพื่อลด false positive
 * เช่น documentNumber pass 1 ตัด "รับ" และ "dc" เพื่อไม่ให้ไปโดนคอลัมน์ "วันที่รับ" หรือ "DC No."
 */
const HEADER_FIELD_CONFIG: Record<HeaderField, FieldConfig> = {
  documentNumber: [
    // pass 1: ชื่อหลัก (ตัด "รับ" และ "dc" เพื่อไม่ให้ไปโดนคอลัมน์อื่น)
    {
      aliases: ['เอกสารเลขที่', 'corr', 'correspondence_number'],
      excludes: ['รับ', 'dc'],
    },
    // pass 2: ชื่อสำรอง
    {
      aliases: [
        'เลขที่เอกสาร',
        'doc no',
        'doc number',
        'document no',
        'document number',
      ],
    },
    // pass 3: ภาษาไทยสำรอง
    {
      aliases: ['เลขที่หนังสือ', 'หนังสือ'],
    },
    // pass 4: "เลขที่" (สั้น — ใช้ต่อจาก pass อื่นเท่านั้น)
    {
      aliases: ['เลขที่'],
    },
    // pass 5: "no" ต้องมี "number" ด้วย (ป้องกัน false positive)
    {
      aliases: ['no'],
      requires: ['number'],
    },
  ],
  subject: [
    {
      aliases: ['subject', 'title', 'เรื่อง', 'ชื่อเรื่อง', 'หัวข้อ'],
    },
  ],
  issuedDate: [
    {
      aliases: [
        'วันที่ออก',
        'วันที่ออกหนังสือ',
        'date of issue',
        'issued date',
        'issue date',
        'วันที่เอกสาร',
        'date issued',
        'issued',
        'sent',
        'ลงวันที่',
      ],
    },
  ],
  receivedDate: [
    {
      aliases: [
        'วันที่รับ',
        'วันรับ',
        'date received',
        'received date',
        'date of receipt',
        'received',
      ],
    },
  ],
  senderOrg: [
    {
      aliases: [
        'ผู้ส่ง',
        'จาก',
        'from',
        'sender',
        'ส่ง',
        'หน่วยงานผู้ส่ง',
        'org from',
      ],
    },
  ],
  receiverOrg: [
    {
      aliases: [
        'ผู้รับ',
        'to',
        'receiver',
        'recipient',
        'ถึง',
        'หน่วยงานผู้รับ',
        'org to',
      ],
    },
  ],
  correspondenceType: [
    {
      aliases: [
        'category',
        'ประเภท',
        'หมวดหมู่',
        'type',
        'correspondence type',
        'ประเภทเอกสาร',
      ],
    },
  ],
  correspondenceTypeId: [
    {
      aliases: [
        'correspondence_type',
        'type_id',
        'correspondence type',
        'corr type',
        'รหัสประเภท',
      ],
    },
  ],
  fileName: [
    {
      aliases: [
        'ชื่อไฟล์',
        'file name',
        'filename',
        'file',
        'ไฟล์',
        'เอกสารแนบ',
        'pdf',
      ],
    },
  ],
  remarks: [
    {
      aliases: ['หมายเหตุ', 'หมายเหตุ', 'remarks', 'remark', 'note', 'notes'],
    },
  ],
  revision: [
    {
      aliases: ['revision', 'rev', 'ฉบับ', 'ครั้งที่'],
    },
  ],
  discipline: [
    {
      aliases: ['discipline', 'วิชาการ', 'สาขา'],
    },
  ],
};

/**
 * ExcelHeaderDetectorService — shared header detector กลางของ Migration module
 *
 * หน้าที่: ตรวจจับ header row จาก Excel โดยใช้ substring matching + multi-pass
 * ถูกใช้โดยทั้ง:
 * - LegacyIngestionService (/admin/migration) — สะสม headers จากหลายแถว
 * - ExcelRowBuilderService (/admin/import-review) — สแกนทีละแถว
 *
 * ก่อนหน้านี้ทั้งสอง service มี alias list และ matching strategy ต่างกัน:
 * - LegacyIngestionService: substring match + aliases มากกว่า
 * - ExcelRowBuilderService: exact match + aliases น้อยกว่า
 * ทำให้ไฟล์ที่อ่านได้ใน /admin/migration อาจอ่านไม่ได้ใน /admin/import-review
 */
@Injectable()
export class ExcelHeaderDetectorService {
  /**
   * ตรวจจับ header จาก map ของ column → list ของ header texts (lowercase)
   * คืน mapping จาก field → 1-based column index (undefined = ไม่พบ)
   *
   * @param colHeaders key = 1-based column number, value = list ของ header texts
   *   ที่พบในคอลัมน์นั้น (จากหนึ่งแถวหรือสะสมจากหลายแถว)
   * @returns HeaderFieldMapping — field → 1-based column index
   */
  detectHeaders(colHeaders: Map<number, string[]>): HeaderFieldMapping {
    const mapping: HeaderFieldMapping = {};
    for (const field of Object.keys(HEADER_FIELD_CONFIG) as HeaderField[]) {
      const col = this.matchField(field, colHeaders);
      if (col !== -1) {
        mapping[field] = col;
      }
    }
    return mapping;
  }

  /**
   * ตรวจจับเฉพาะ field หนึ่ง — ลองแต่ละ pass ตามลำดับ
   * คืน 1-based column index หรือ -1 ถ้าไม่พบ
   */
  private matchField(
    field: HeaderField,
    colHeaders: Map<number, string[]>
  ): number {
    const passes = HEADER_FIELD_CONFIG[field];
    for (const pass of passes) {
      const col = this.firstMatch(
        pass.aliases,
        colHeaders,
        pass.requires,
        pass.excludes
      );
      if (col !== -1) {
        return col;
      }
    }
    return -1;
  }

  /**
   * ค้นหาคอลัมน์แรกที่ header ตรงกับ alias ใด ๆ (substring match)
   * โดยเช็ค excludes และ requires ตามเงื่อนไข
   */
  private firstMatch(
    predicates: string[],
    colHeaders: Map<number, string[]>,
    mustInclude?: string[],
    mustNotInclude?: string[]
  ): number {
    for (const [col, headers] of colHeaders) {
      if (headers.length === 0) {
        continue;
      }
      for (const h of headers) {
        if (predicates.some((p) => h.includes(p))) {
          if (mustNotInclude?.some((ex) => h.includes(ex))) {
            continue;
          }
          if (mustInclude?.some((req) => !h.includes(req))) {
            continue;
          }
          return col;
        }
      }
    }
    return -1;
  }
}
