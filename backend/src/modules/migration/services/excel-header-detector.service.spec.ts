// File: backend/src/modules/migration/services/excel-header-detector.service.spec.ts
// Change Log:
// - 2026-09-12: Initial creation — unit test สำหรับ ExcelHeaderDetectorService
//   ตรวจสอบ substring matching + multi-pass logic + unified aliases

import { ExcelHeaderDetectorService } from './excel-header-detector.service';

describe('ExcelHeaderDetectorService', () => {
  let service: ExcelHeaderDetectorService;

  beforeEach(() => {
    service = new ExcelHeaderDetectorService();
  });

  /** สร้าง colHeaders map จาก array ของ [col, header] */
  const makeColHeaders = (
    entries: Array<[number, string]>
  ): Map<number, string[]> => {
    const map = new Map<number, string[]>();
    for (const [col, header] of entries) {
      map.set(col, [header.toLowerCase()]);
    }
    return map;
  };

  describe('documentNumber — substring matching + multi-pass', () => {
    it('match "เอกสารเลขที่" แบบ exact', () => {
      const map = makeColHeaders([[1, 'เอกสารเลขที่']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
    });

    it('match "เอกสารเลขที่" เป็น substring ของ header ที่ยาวกว่า', () => {
      const map = makeColHeaders([[2, 'เอกสารเลขที่ขาออก']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(2);
    });

    it('ไม่ match "เอกสารเลขที่รับ" ใน pass 1 (excludes "รับ") แต่ match ใน pass 4 ("เลขที่")', () => {
      const map = makeColHeaders([[3, 'เอกสารเลขที่รับ']]);
      const result = service.detectHeaders(map);
      // pass 1 excludes "รับ" → skip; pass 4 "เลขที่" เป็น substring ของ "เอกสารเลขที่รับ" → match
      expect(result.documentNumber).toBe(3);
    });

    it('match "Corr. No." ผ่าน substring "corr" (pass 1, ไม่มี "รับ" หรือ "dc")', () => {
      const map = makeColHeaders([[1, 'Corr. No.']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
    });

    it('match "Document Number" ผ่าน pass 2 (substring "document number")', () => {
      const map = makeColHeaders([[1, 'Document Number']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
    });

    it('match "เลขที่หนังสือ" ผ่าน pass 3', () => {
      const map = makeColHeaders([[5, 'เลขที่หนังสือ']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(5);
    });

    it('match "เลขที่" ผ่าน pass 4', () => {
      const map = makeColHeaders([[7, 'เลขที่']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(7);
    });

    it('ไม่ match "no" เฉย ๆ (pass 5 requires "number")', () => {
      const map = makeColHeaders([[1, 'no']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBeUndefined();
    });

    it('match "Document No." ผ่าน pass 2 (substring "document no")', () => {
      const map = makeColHeaders([[1, 'Document No.']]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
    });

    it('ไม่ match เมื่อ header ไม่มี alias ใด ๆ ของ documentNumber', () => {
      const map = makeColHeaders([
        [1, 'ลำดับ'],
        [2, 'หมายเหตุ'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBeUndefined();
    });
  });

  describe('fields อื่น ๆ — substring matching', () => {
    it('match subject จาก "Subject"', () => {
      const map = makeColHeaders([
        [1, 'Subject'],
        [2, 'เอกสารเลขที่'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.subject).toBe(1);
      expect(result.documentNumber).toBe(2);
    });

    it('match subject จาก "เรื่อง"', () => {
      const map = makeColHeaders([
        [3, 'เรื่อง'],
        [1, 'เอกสารเลขที่'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.subject).toBe(3);
    });

    it('match issuedDate จาก "วันที่ออก"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [4, 'วันที่ออก'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.issuedDate).toBe(4);
    });

    it('match receivedDate จาก "วันที่รับ"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [5, 'วันที่รับ'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.receivedDate).toBe(5);
    });

    it('match senderOrg จาก "จาก"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [6, 'จาก'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.senderOrg).toBe(6);
    });

    it('match receiverOrg จาก "ถึง"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [7, 'ถึง'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.receiverOrg).toBe(7);
    });

    it('match correspondenceType จาก "ประเภท"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [8, 'ประเภท'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.correspondenceType).toBe(8);
    });

    it('match fileName จาก "ชื่อไฟล์"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [9, 'ชื่อไฟล์'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.fileName).toBe(9);
    });

    it('match remarks จาก "หมายเหตุ"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [10, 'หมายเหตุ'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.remarks).toBe(10);
    });

    it('match revision จาก "Rev"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [11, 'Rev'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.revision).toBe(11);
    });

    it('match discipline จาก "Discipline"', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [12, 'Discipline'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.discipline).toBe(12);
    });
  });

  describe('multi-row accumulation', () => {
    it('รองรับ header กระจายอยู่ในหลายแถว (accumulation)', () => {
      // สมมุติ col 1 มี header ในแถวที่ 2, col 2 มี header ในแถวที่ 3
      const map = new Map<number, string[]>();
      map.set(1, ['ทะเบียนเอกสาร', 'เอกสารเลขที่']);
      map.set(2, ['หัวข้อ', 'เรื่อง']);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
      expect(result.subject).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('คืน empty mapping เมื่อ colHeaders ว่าง', () => {
      const result = service.detectHeaders(new Map());
      expect(result.documentNumber).toBeUndefined();
      expect(result.subject).toBeUndefined();
    });

    it('เลือกคอลัมน์แรกที่ match เมื่อหลายคอลัมน์ match alias เดียวกัน', () => {
      const map = makeColHeaders([
        [1, 'เอกสารเลขที่'],
        [2, 'เอกสารเลขที่สำรอง'],
      ]);
      const result = service.detectHeaders(map);
      expect(result.documentNumber).toBe(1);
    });
  });
});
