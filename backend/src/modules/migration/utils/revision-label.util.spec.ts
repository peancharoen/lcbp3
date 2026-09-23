// File: backend/src/modules/migration/utils/revision-label.util.spec.ts
// Change Log:
// - 2026-09-23: Initial creation — unit test revision label normalization
//   (FR-007 revision chain): numeric/alpha mapping, comparison, upsert helpers

import { compareRevisionLabels } from './compare-revision-labels.util';
import { findRevisionByLabel } from './find-revision-by-label.util';
import { nextFreeRevisionNumber } from './next-free-revision-number.util';
import { normalizeRevisionLabel } from './normalize-revision-label.util';
import { pickCurrentRevision } from './pick-current-revision.util';
import { revisionLabelOf } from './revision-label-of.util';

describe('revision-label.util', () => {
  describe('normalizeRevisionLabel', () => {
    it('ค่าว่าง/null/undefined → default label "0" rank 0', () => {
      for (const raw of [undefined, null, '', '   ']) {
        const norm = normalizeRevisionLabel(raw);
        expect(norm).toEqual({
          label: '0',
          rank: 0,
          kind: 'numeric',
          isValid: true,
        });
      }
    });

    it('numeric label → rank = ตัวเลข ("0"→0, "1"→1, "07"→7)', () => {
      expect(normalizeRevisionLabel('0').rank).toBe(0);
      expect(normalizeRevisionLabel('1').rank).toBe(1);
      expect(normalizeRevisionLabel('2').rank).toBe(2);
      const norm = normalizeRevisionLabel('07');
      expect(norm.label).toBe('07');
      expect(norm.rank).toBe(7);
      expect(norm.kind).toBe('numeric');
    });

    it('alpha label → uppercase + rank zero-based (A=0, B=1, C=2)', () => {
      expect(normalizeRevisionLabel('A')).toMatchObject({
        label: 'A',
        rank: 0,
        kind: 'alpha',
        isValid: true,
      });
      expect(normalizeRevisionLabel('b')).toMatchObject({
        label: 'B',
        rank: 1,
        kind: 'alpha',
      });
      expect(normalizeRevisionLabel('C').rank).toBe(2);
      expect(normalizeRevisionLabel(' a ').label).toBe('A');
    });

    it('multi-letter → base-26 positional (AA=26)', () => {
      expect(normalizeRevisionLabel('AA').rank).toBe(26);
      expect(normalizeRevisionLabel('Z').rank).toBe(25);
    });

    it('label ที่ไม่รู้จัก ("R1", "1A", "rev 2") → isValid=false, rank=-1', () => {
      for (const raw of ['R1', '1A', 'rev 2', 'A-1']) {
        const norm = normalizeRevisionLabel(raw);
        expect(norm.isValid).toBe(false);
        expect(norm.rank).toBe(-1);
        expect(norm.kind).toBe('other');
        expect(norm.label).toBe(raw);
      }
    });
  });

  describe('compareRevisionLabels', () => {
    it('numeric เทียบตามค่า: "0" < "1" < "2"', () => {
      expect(compareRevisionLabels('0', '1')).toBeLessThan(0);
      expect(compareRevisionLabels('2', '1')).toBeGreaterThan(0);
      expect(compareRevisionLabels('1', '1')).toBe(0);
    });

    it('alpha เทียบตามลำดับตัวอักษร: "A" < "B" < "C"', () => {
      expect(compareRevisionLabels('A', 'B')).toBeLessThan(0);
      expect(compareRevisionLabels('C', 'B')).toBeGreaterThan(0);
    });

    it('mixed scheme: rank เท่ากัน numeric มาก่อน alpha ("0" < "A")', () => {
      expect(compareRevisionLabels('0', 'A')).toBeLessThan(0);
      expect(compareRevisionLabels('B', '1')).toBeGreaterThan(0);
    });

    it('rank สูงกว่าชนะเสมอข้าม scheme ("2" > "A", "10" > "C")', () => {
      expect(compareRevisionLabels('2', 'A')).toBeGreaterThan(0);
      expect(compareRevisionLabels('10', 'C')).toBeGreaterThan(0);
    });
  });

  describe('revisionLabelOf / findRevisionByLabel', () => {
    it('fallback เป็น revisionNumber เมื่อไม่มี revisionLabel (row เก่า)', () => {
      expect(revisionLabelOf({ revisionNumber: 0 })).toBe('0');
      expect(revisionLabelOf({ revisionNumber: 1, revisionLabel: 'B' })).toBe(
        'B'
      );
    });

    it('match revision ด้วย normalized label (case-insensitive)', () => {
      const revisions = [
        { id: 1, revisionNumber: 0, revisionLabel: '0' },
        { id: 2, revisionNumber: 1, revisionLabel: 'B' },
      ];
      expect(findRevisionByLabel(revisions, '0')?.id).toBe(1);
      expect(findRevisionByLabel(revisions, 'b')?.id).toBe(2);
      expect(findRevisionByLabel(revisions, 'A')).toBeUndefined();
      // label '1' ตรง rev 'B' ไหม? ไม่ — label เทียบกันไม่ใช่ rank
      expect(findRevisionByLabel(revisions, '1')).toBeUndefined();
    });
  });

  describe('pickCurrentRevision', () => {
    it('เลือก label ลำดับสูงสุด — order-independent (C มาก่อน A ใน array ก็ได้ C)', () => {
      const revisions = [
        { id: 3, revisionNumber: 2, revisionLabel: 'C' },
        { id: 1, revisionNumber: 0, revisionLabel: 'A' },
        { id: 2, revisionNumber: 1, revisionLabel: 'B' },
      ];
      expect(pickCurrentRevision(revisions).id).toBe(3);
    });

    it('rank เท่ากัน mixed scheme — alpha ชนะเป็น current ("C" > "2")', () => {
      // tie-break: numeric < alpha → alpha เป็นลำดับสูงกว่า
      const revisions = [
        { id: 1, revisionNumber: 2, revisionLabel: '2' },
        { id: 2, revisionNumber: 0, revisionLabel: 'C' },
      ];
      expect(pickCurrentRevision(revisions).id).toBe(2);
    });
  });

  describe('nextFreeRevisionNumber', () => {
    it('คืน preferred ถ้าว่าง', () => {
      expect(nextFreeRevisionNumber([], 0)).toBe(0);
      expect(nextFreeRevisionNumber([0], 1)).toBe(1);
    });

    it('เลื่อนไปเลขว่างถัดไปเมื่อชน (mixed scheme "0" กับ "A" ทั้งคู่ rank 0)', () => {
      expect(nextFreeRevisionNumber([0], 0)).toBe(1);
      expect(nextFreeRevisionNumber([0, 1], 0)).toBe(2);
      expect(nextFreeRevisionNumber([0, 2], 2)).toBe(3);
    });
  });
});
