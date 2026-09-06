// File: backend/src/modules/migration/services/excel-date-parser.service.ts
// Change Log:
// - 2026-09-06: Initial creation — ExcelDateParserService (T004, FR-004/FR-005)
//   ทำหน้าที่แปลงค่าวันที่จาก Excel cell ทุกรูปแบบ (native Date, Excel serial,
//   Thai DMY พ.ศ./ค.ศ., เดือนไทย/อังกฤษ, 2-digit year heuristic, RichText)
//   พร้อม Chronology guard (issued <= received <= NOW+1 วัน) ตาม ADR-052
//   เป็น superset ของ legacy parseDateCell ใน legacy-ingestion.service.ts

import { Injectable, Logger } from '@nestjs/common';

/**
 * ช่วง Excel serial number ที่รับ (ป้องกันค่าขยะและค่าที่ไม่ใช่วันที่จริง)
 * - ต่ำกว่า 20000 ≈ ปี 1954 (เก่าเกินไปสำหรับ Correspondence สมัยใหม่)
 * - สูงกว่า 100000 ≈ ปี 2174 (เกินเกตวันที่ระบบ)
 */
const EXCEL_SERIAL_MIN = 20000;
const EXCEL_SERIAL_MAX = 100000;

/** เกตปีหลังแปลง (ป้องกันปีพ.ศ.ที่ยังไม่ถูกลบ 543 หรือปีเกินไป) */
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

/** จุดตัดสินใจปี พ.ศ. เมื่อเป็น 4 หลัก (ค่าที่มากกว่านี้ถือว่าเป็น พ.ศ.) */
const BUDDHIST_ERA_THRESHOLD = 2400;

/** จำนวนปีที่ต้องลบเพื่อแปลง พ.ศ. → ค.ศ. */
const BE_TO_CE_OFFSET = 543;

/** วันที่ Epoch ของ Excel serial (1899-12-30 UTC — ใช้ UTC เพื่อกัน timezone drift) */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** จำนวนวินาทีต่อวัน */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ชื่อเดือนภาษาไทยแบบย่อ → ดัชนีเดือน (0-11) */
const THAI_MONTH_ABBR: Record<string, number> = {
  'ม.ค.': 0,
  'ก.พ.': 1,
  'มี.ค.': 2,
  'เม.ย.': 3,
  'พ.ค.': 4,
  'มิ.ย.': 5,
  'ก.ค.': 6,
  'ส.ค.': 7,
  'ก.ย.': 8,
  'ต.ค.': 9,
  'พ.ย.': 10,
  'ธ.ค.': 11,
};

/** ชื่อเดือนภาษาไทยแบบเต็ม → ดัชนีเดือน (0-11) */
const THAI_MONTH_FULL: Record<string, number> = {
  มกราคม: 0,
  กุมภาพันธ์: 1,
  มีนาคม: 2,
  เมษายน: 3,
  พฤษภาคม: 4,
  มิถุนายน: 5,
  กรกฎาคม: 6,
  สิงหาคม: 7,
  กันยายน: 8,
  ตุลาคม: 9,
  พฤศจิกายน: 10,
  ธันวาคม: 11,
};

/** ชื่อเดือนภาษาอังกฤษแบบย่อ → ดัชนีเดือน (0-11) */
const EN_MONTH_ABBR: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** ชื่อเดือนภาษาอังกฤษแบบเต็ม → ดัชนีเดือน (0-11) */
const EN_MONTH_FULL: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * ExcelDateParserService — ตัวแปลงวันที่กลางของ 4-Layer Pipeline (T004)
 *
 * หลักการ:
 * - รับค่าจาก Excel cell ได้ทุกรูปแบบ (unknown) และคืน Date หรือ undefined
 * - ไม่ throw แม้ input แปลก ๆ — คืน undefined ให้ Layer 1 รายงานเป็น finding แทน
 * - รองรับ พ.ศ. → ค.ศ. อัตโนมัติ (ปี > 2400 ลบ 543)
 * - รองรับเดือนไทยทั้งแบบย่อและเต็ม และเดือนอังกฤษทั้งสองรูปแบบ
 * - 2-digit year heuristic: yy <= currentCE2Digit+10 → ค.ศ. (2000+yy),
 *   มิฉะนั้นถือเป็น พ.ศ. (2500+yy - 543)
 * - เกตปีสุดท้าย 1900-2100 เพื่อกันค่าไร้สาระ
 */
@Injectable()
export class ExcelDateParserService {
  private readonly logger = new Logger(ExcelDateParserService.name);

  /**
   * แปลงค่าจาก Excel cell เป็น Date
   * คืน undefined เมื่อแปลงไม่ได้ ไม่ throw
   */
  parse(input: unknown): Date | undefined {
    if (input === null || input === undefined) {
      return undefined;
    }

    // 1) native Date — คืนตรง ๆ ถ้า valid
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? undefined : input;
    }

    // 2) boolean / function / symbol → ไม่ใช่วันที่
    if (typeof input === 'boolean' || typeof input === 'function') {
      return undefined;
    }

    if (typeof input === 'symbol') {
      return undefined;
    }

    // 3) number — ถือเป็น Excel serial
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        return undefined;
      }
      if (input < EXCEL_SERIAL_MIN || input > EXCEL_SERIAL_MAX) {
        return undefined;
      }
      const ms = EXCEL_EPOCH_MS + Math.round(input) * MS_PER_DAY;
      const date = new Date(ms);
      return this.validateYear(date) ? date : undefined;
    }

    // 4) string — ลอง parse หลายรูปแบบ
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed === '') {
        return undefined;
      }
      return this.parseString(trimmed);
    }

    // 5) RichText object ที่มี field text (superset ของ legacy)
    if (typeof input === 'object' && input !== null) {
      const maybeText = (input as { text?: unknown }).text;
      if (typeof maybeText === 'string' && maybeText.trim() !== '') {
        return this.parseString(maybeText.trim());
      }
    }

    // 6) array หรือ object อื่น ๆ → undefined (ไม่ throw)
    return undefined;
  }

  /**
   * ตรวจลำดับวันที่ตาม FR-005
   * - issued <= received (ถ้าระบุทั้งคู่)
   * - ทั้งคู่ <= NOW + 1 วัน (ถ้าระบุ)
   * - ถ้าไม่ระบุบางค่า → คืน true (Layer 1 รายงาน missing แยกต่างหาก)
   */
  isChronologyValid(issued?: Date, received?: Date): boolean {
    const nowPlus1Day = Date.now() + MS_PER_DAY;

    if (issued && received && issued.getTime() > received.getTime()) {
      return false;
    }

    if (issued && issued.getTime() > nowPlus1Day) {
      return false;
    }

    if (received && received.getTime() > nowPlus1Day) {
      return false;
    }

    return true;
  }

  // ---------- internals ----------

  /** เกตปีอยู่ในช่วง 1900-2100 */
  private validateYear(date: Date): boolean {
    const y = date.getFullYear();
    return y >= YEAR_MIN && y <= YEAR_MAX;
  }

  /** parse string หลายรูปแบบ */
  private parseString(text: string): Date | undefined {
    // ลอง DMY ก่อน (รูปแบบหลักของไทย)
    const dmy = this.tryParseDMY(text);
    if (dmy) {
      return dmy;
    }

    // ลอง ISO-ish (YYYY-MM-DD) เป็น fallback
    const iso = this.tryParseISO(text);
    if (iso) {
      return iso;
    }

    return undefined;
  }

  /** parse รูปแบบ D[M/-/ ]M[M/-/ ]Y หรือ D <month-name> Y */
  private tryParseDMY(text: string): Date | undefined {
    // รูปแบบตัวเลข: dd[/- ]mm[/- ]yyyy หรือ dd[/- ]mm[/- ]yy
    const numericMatch = text.match(
      /^(\d{1,2})[/\-\s](\d{1,2})[/\-\s](\d{2,4})$/
    );
    if (numericMatch) {
      const [, dStr, mStr, yStr] = numericMatch;
      return this.buildDateFromParts(dStr, mStr, yStr);
    }

    // รูปแบบชื่อเดือน: dd <month-name> yyyy หรือ dd-month-yyyy
    const namedMatch = text.match(
      /^(\d{1,2})[-\s]+([^\d\s-]+(?:\.[^\d\s-]+)*)[-\s]+(\d{2,4})$/i
    );
    if (namedMatch) {
      const [, dStr, monthStr, yStr] = namedMatch;
      const monthIdx = this.resolveMonthByName(monthStr);
      if (monthIdx === undefined) {
        return undefined;
      }
      const day = Number(dStr);
      const year = this.normalizeYear(yStr);
      if (year === undefined) {
        return undefined;
      }
      return this.buildValidDate(year, monthIdx, day);
    }

    return undefined;
  }

  /** parse รูปแบบ ISO YYYY-MM-DD (fallback) */
  private tryParseISO(text: string): Date | undefined {
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!isoMatch) {
      // ลอง Date.parse ทั่วไปเป็นทางเลือกสุดท้าย
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime()) && this.validateYear(parsed)) {
        return parsed;
      }
      return undefined;
    }
    const [, yStr, mStr, dStr] = isoMatch;
    const year = Number(yStr);
    const month = Number(mStr) - 1;
    const day = Number(dStr);
    if (year < YEAR_MIN || year > YEAR_MAX) {
      return undefined;
    }
    return this.buildValidDate(year, month, day);
  }

  /** สร้าง Date จาก day/month/year string ที่ยังไม่ normalize */
  private buildDateFromParts(
    dStr: string,
    mStr: string,
    yStr: string
  ): Date | undefined {
    const day = Number(dStr);
    const month = Number(mStr) - 1;
    if (month < 0 || month > 11) {
      return undefined;
    }
    const year = this.normalizeYear(yStr);
    if (year === undefined) {
      return undefined;
    }
    return this.buildValidDate(year, month, day);
  }

  /**
   * normalize ปี: 4 หลัก → ตรวจ พ.ศ./ค.ศ., 2 หลัก → heuristic
   * คืนเป็น ค.ศ. หรือ undefined ถ้าเกินเกต
   */
  private normalizeYear(yStr: string): number | undefined {
    const num = Number(yStr);
    if (!Number.isFinite(num)) {
      return undefined;
    }

    let year: number;
    if (yStr.length <= 2) {
      // 2-digit heuristic: yy <= currentCE2Digit+10 → ค.ศ. (2000+yy)
      // มิฉะนั้นถือเป็น พ.ศ. (2500+yy - 543)
      const currentCE2Digit = new Date().getFullYear() % 100;
      const threshold = currentCE2Digit + 10;
      if (num <= threshold) {
        year = 2000 + num;
      } else {
        year = 2500 + num - BE_TO_CE_OFFSET;
      }
    } else if (num > BUDDHIST_ERA_THRESHOLD) {
      // 4 หลัก พ.ศ. → ค.ศ.
      year = num - BE_TO_CE_OFFSET;
    } else {
      year = num;
    }

    if (year < YEAR_MIN || year > YEAR_MAX) {
      return undefined;
    }
    return year;
  }

  /** แปลงชื่อเดือน (ไทย/อังกฤษ แบบย่อ/เต็ม) เป็นดัชนี 0-11 */
  private resolveMonthByName(name: string): number | undefined {
    const lower = name.toLowerCase();
    if (THAI_MONTH_ABBR[name] !== undefined) {
      return THAI_MONTH_ABBR[name];
    }
    if (THAI_MONTH_FULL[name] !== undefined) {
      return THAI_MONTH_FULL[name];
    }
    if (EN_MONTH_ABBR[lower] !== undefined) {
      return EN_MONTH_ABBR[lower];
    }
    if (EN_MONTH_FULL[lower] !== undefined) {
      return EN_MONTH_FULL[lower];
    }
    return undefined;
  }

  /** สร้าง Date และตรวจความถูกต้อง (วันที่มีอยู่จริงในปฏิทิน) */
  private buildValidDate(
    year: number,
    month: number,
    day: number
  ): Date | undefined {
    if (day < 1 || day > 31) {
      return undefined;
    }
    const date = new Date(year, month, day);
    // ตรวจว่า Date ไม่ "overflow" เช่น 31/02 → 03/03
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return undefined;
    }
    return this.validateYear(date) ? date : undefined;
  }
}
