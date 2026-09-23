// File: frontend/lib/utils/__tests__/queue-doc-number.test.ts
// Change Log:
// - 2026-09-24: Initial — coverage สำหรับ queue doc number helpers
//   (revision-chain import: document_number = staging key)

import { describe, it, expect } from 'vitest';
import {
  getQueueBaseDocNumber,
  getQueueRevisionLabel,
  getQueueDocDisplayText,
} from '@/lib/utils/queue-doc-number';

describe('getQueueBaseDocNumber', () => {
  it('คืน original_document_number เมื่อมีใน details', () => {
    const item = {
      documentNumber: 'DOC-001-RA',
      details: { original_document_number: 'DOC-001', revision_label: 'A' },
    };
    expect(getQueueBaseDocNumber(item)).toBe('DOC-001');
  });

  it('fallback เป็น documentNumber เมื่อไม่มี details', () => {
    expect(
      getQueueBaseDocNumber({ documentNumber: 'DOC-002', details: null })
    ).toBe('DOC-002');
    expect(
      getQueueBaseDocNumber({ documentNumber: 'DOC-002', details: undefined })
    ).toBe('DOC-002');
  });

  it('fallback เป็น documentNumber เมื่อ original_document_number ว่าง/ไม่ใช่ string', () => {
    expect(
      getQueueBaseDocNumber({
        documentNumber: 'DOC-003-R1',
        details: { original_document_number: '   ' },
      })
    ).toBe('DOC-003-R1');
    expect(
      getQueueBaseDocNumber({
        documentNumber: 'DOC-003-R1',
        details: { original_document_number: 42 },
      })
    ).toBe('DOC-003-R1');
  });

  it('trim whitespace ของ original_document_number', () => {
    expect(
      getQueueBaseDocNumber({
        documentNumber: 'DOC-004-RB',
        details: { original_document_number: '  DOC-004  ' },
      })
    ).toBe('DOC-004');
  });
});

describe('getQueueRevisionLabel', () => {
  it('คืน revision_label เมื่อมีใน details', () => {
    expect(
      getQueueRevisionLabel({
        documentNumber: 'DOC-RA',
        details: { revision_label: 'A' },
      })
    ).toBe('A');
    expect(
      getQueueRevisionLabel({
        documentNumber: 'DOC',
        details: { revision_label: '0' },
      })
    ).toBe('0');
  });

  it('คืน undefined เมื่อไม่มี label (legacy item)', () => {
    expect(
      getQueueRevisionLabel({ documentNumber: 'DOC', details: null })
    ).toBeUndefined();
    // legacy revision_number (dedup counter) ไม่ใช่ label — ห้ามเอามาแสดง
    expect(
      getQueueRevisionLabel({
        documentNumber: 'DOC-R1',
        details: { revision_number: 1, original_document_number: 'DOC' },
      })
    ).toBeUndefined();
  });

  it('trim label และคืน undefined สำหรับค่าว่าง', () => {
    expect(
      getQueueRevisionLabel({
        documentNumber: 'DOC',
        details: { revision_label: '  B ' },
      })
    ).toBe('B');
    expect(
      getQueueRevisionLabel({
        documentNumber: 'DOC',
        details: { revision_label: '' },
      })
    ).toBeUndefined();
  });
});

describe('getQueueDocDisplayText', () => {
  it('รวมเลขฐานกับ revision label', () => {
    expect(
      getQueueDocDisplayText({
        documentNumber: 'DOC-001-RB',
        details: { original_document_number: 'DOC-001', revision_label: 'B' },
      })
    ).toBe('DOC-001 (Rev. B)');
  });

  it('คืนเลขเอกสารอย่างเดียวเมื่อไม่มี revision label', () => {
    expect(
      getQueueDocDisplayText({ documentNumber: 'DOC-002', details: null })
    ).toBe('DOC-002');
  });
});
