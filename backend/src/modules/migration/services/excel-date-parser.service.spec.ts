// File: backend/src/modules/migration/services/excel-date-parser.service.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ ExcelDateParserService
//   (T004, FR-004 วันที่ DMY/B.E. + FR-005 Chronology guard) ตาม TDD RED ก่อน implement

import { ExcelDateParserService } from './excel-date-parser.service';

/**
 * ชุดทดสอบ ExcelDateParserService — ตัวแปลงวันที่กลางของ Pipeline
 *
 * หมายเหตุ: เคส 2-digit year ('25' → 2025 C.E. / '68' → 2568 → 2025 B.E.)
 * ผูกกับปีปัจจุบันตาม heuristic ที่ระบุใน tasks.md (yy <= currentCE2Digit+10 → C.E.)
 * ตัวอย่างที่ pin ไว้นี้ถูกต้องสำหรับปี 2016-2057 (current2Digit 16..57)
 */
describe('ExcelDateParserService', () => {
  let service: ExcelDateParserService;

  beforeEach(() => {
    service = new ExcelDateParserService();
  });

  describe('parse — รูปแบบพื้นฐาน (superset ของ legacy parseDateCell)', () => {
    it('คืนค่า native Date ที่ valid ตรง ๆ', () => {
      const input = new Date(2025, 7, 15, 10, 30);
      const result = service.parse(input);
      expect(result).toBe(input);
    });

    it('คืน undefined เมื่อ native Date เป็น Invalid Date', () => {
      expect(service.parse(new Date('not-a-date'))).toBeUndefined();
    });

    it('แปลง Excel serial number 45903 → 2025-09-03 (UTC)', () => {
      const result = service.parse(45903);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2025);
      expect(result?.getUTCMonth()).toBe(8);
      expect(result?.getUTCDate()).toBe(3);
    });

    it('คืน undefined สำหรับ serial 999 (ต่ำกว่าช่วง 20000-100000)', () => {
      expect(service.parse(999)).toBeUndefined();
    });

    it('คืน undefined สำหรับ serial เป็นลบ', () => {
      expect(service.parse(-5000)).toBeUndefined();
    });

    it('คืน undefined สำหรับ null / undefined / empty string / boolean', () => {
      expect(service.parse(null)).toBeUndefined();
      expect(service.parse(undefined)).toBeUndefined();
      expect(service.parse('')).toBeUndefined();
      expect(service.parse(true)).toBeUndefined();
    });

    it('คืน undefined สำหรับข้อความที่แปลงไม่ได้ ("hello")', () => {
      expect(service.parse('hello')).toBeUndefined();
    });

    it('แปลง ISO-ish string ผ่าน fallback ("2025-08-15") ได้', () => {
      const result = service.parse('2025-08-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง RichText object ที่มี field text ได้ (superset ของ legacy)', () => {
      const richText = { text: '15/08/2568', richText: [] };
      const result = service.parse(richText);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });
  });

  describe('parse — Thai DMY text (FR-004)', () => {
    it('แปลง "15/08/2025" (DD/MM/YYYY ค.ศ.) ได้', () => {
      const result = service.parse('15/08/2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15-08-2025" (ขีดกลาง) ได้', () => {
      const result = service.parse('15-08-2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 08 2025" (เว้นวรรค) ได้', () => {
      const result = service.parse('15 08 2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "  15/08/2025  " (มีช่องว่างรอบ ๆ) ได้', () => {
      const result = service.parse('  15/08/2025  ');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15/08/2568" (พ.ศ. → ค.ศ. อัตโนมัติ -543) ได้', () => {
      const result = service.parse('15/08/2568');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 ส.ค. 2568" (เดือนย่อภาษาไทย) ได้', () => {
      const result = service.parse('15 ส.ค. 2568');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 สิงหาคม 2568" (ชื่อเดือนเต็มภาษาไทย) ได้', () => {
      const result = service.parse('15 สิงหาคม 2568');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15-Aug-2025" (เดือนย่ออังกฤษ + ขีดกลาง) ได้', () => {
      const result = service.parse('15-Aug-2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 Aug 2025" (เดือนย่ออังกฤษ + เว้นวรรค) ได้', () => {
      const result = service.parse('15 Aug 2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 August 2025" (ชื่อเดือนเต็มอังกฤษ) ได้', () => {
      const result = service.parse('15 August 2025');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });

    it('แปลง "15 ม.ค. 2568" (เดือนย่อไทยเดือนแรกของปี) ได้', () => {
      const result = service.parse('15 ม.ค. 2568');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(15);
    });
  });

  describe('parse — heuristic ปี 2 หลัก (FR-004)', () => {
    it('แปลง "25/08/25" → ค.ศ. 2025 (yy น้อยกว่า currentCE2Digit+10)', () => {
      const result = service.parse('25/08/25');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(25);
    });

    it('แปลง "25/08/68" → พ.ศ. 2568 → ค.ศ. 2025 (yy มากกว่า threshold)', () => {
      const result = service.parse('25/08/68');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(25);
    });

    it('แปลง "15 ส.ค. 68" (เดือนไทย + ปี 2 หลัก พ.ศ.) ได้', () => {
      const result = service.parse('15 ส.ค. 68');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(7);
      expect(result?.getDate()).toBe(15);
    });
  });

  describe('parse — ค่าไร้สาระต้องคืน undefined (ไม่ throw)', () => {
    it('คืน undefined สำหรับ "31/02/2025" (วันที่ไม่มีอยู่จริง)', () => {
      expect(service.parse('31/02/2025')).toBeUndefined();
    });

    it('คืน undefined สำหรับ "15/13/2025" (เดือนเกิน 12)', () => {
      expect(service.parse('15/13/2025')).toBeUndefined();
    });

    it('คืน undefined สำหรับ "15/08/9999" (ปีเกิน gate 1900-2100 หลังแปลง)', () => {
      expect(service.parse('15/08/9999')).toBeUndefined();
    });

    it('คืน undefined แทนการ throw เมื่อเจอ object/array แปลก ๆ', () => {
      expect(service.parse({ weird: 'object' })).toBeUndefined();
      expect(() => service.parse([1, 2, 3])).not.toThrow();
      expect(service.parse(Symbol('x'))).toBeUndefined();
    });
  });

  describe('isChronologyValid — FR-005 (issued <= received และ <= NOW+1 วัน)', () => {
    it('คืน true เมื่อ issued <= received และทั้งคู่ <= NOW+1 วัน', () => {
      const issued = new Date('2025-08-15T00:00:00Z');
      const received = new Date('2025-08-16T00:00:00Z');
      expect(service.isChronologyValid(issued, received)).toBe(true);
    });

    it('คืน true เมื่อ issued === received', () => {
      const same = new Date('2025-08-15T00:00:00Z');
      expect(service.isChronologyValid(same, same)).toBe(true);
    });

    it('คืน false เมื่อ issued > received (ลำดับวันที่ขัดแย้ง)', () => {
      const issued = new Date('2025-08-16T00:00:00Z');
      const received = new Date('2025-08-15T00:00:00Z');
      expect(service.isChronologyValid(issued, received)).toBe(false);
    });

    it('คืน false เมื่อ received อยู่ในอนาคตเกิน NOW+1 วัน', () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const past = new Date('2025-08-15T00:00:00Z');
      expect(service.isChronologyValid(past, future)).toBe(false);
    });

    it('คืน false เมื่อ issued อยู่ในอนาคตเกิน NOW+1 วัน', () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      expect(service.isChronologyValid(future, future)).toBe(false);
    });

    it('คืน true เมื่อ issued ไม่ระบุ (Layer 1 รายงาน missing แยกต่างหาก)', () => {
      expect(service.isChronologyValid(undefined, new Date())).toBe(true);
    });

    it('คืน true เมื่อ received ไม่ระบุ', () => {
      expect(service.isChronologyValid(new Date(), undefined)).toBe(true);
    });

    it('คืน true เมื่อไม่ระบุทั้งคู่', () => {
      expect(service.isChronologyValid(undefined, undefined)).toBe(true);
    });

    it('คืน true เมื่อวันที่อยู่ในอนาคตแต่ไม่เกิน NOW+1 วัน', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000);
      expect(service.isChronologyValid(soon, soon)).toBe(true);
    });
  });
});
