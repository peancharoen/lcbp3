// File: frontend/lib/utils/__tests__/queue-file.test.ts
// Change Log:
// - 2026-09-24: Initial — coverage สำหรับ queue file helpers
//   (สถานะพบ/ไม่พบไฟล์ + ชื่อไฟล์ที่แสดงใน Legacy Review Queue)

import { describe, it, expect } from 'vitest';
import {
  getQueueAttachments,
  getQueueFileName,
  hasQueueFile,
} from '@/lib/utils/queue-file';

describe('getQueueAttachments', () => {
  it('คืน attachments จาก details', () => {
    const item = {
      details: {
        attachments: [
          { originalFilename: 'a.pdf', isMainDocument: true },
          { originalFilename: 'b.pdf' },
        ],
      },
    };
    expect(getQueueAttachments(item)).toHaveLength(2);
  });

  it('คืน [] เมื่อ details ไม่มี / attachments ไม่ใช่ array', () => {
    expect(getQueueAttachments({ details: null })).toEqual([]);
    expect(getQueueAttachments({ details: {} })).toEqual([]);
    expect(
      getQueueAttachments({ details: { attachments: 'nope' } })
    ).toEqual([]);
  });

  it('กรอง non-object entries ออก', () => {
    const item = {
      details: { attachments: ['x', null, { originalFilename: 'a.pdf' }] },
    };
    expect(getQueueAttachments(item)).toHaveLength(1);
  });
});

describe('hasQueueFile', () => {
  it('true เมื่อมี attachment', () => {
    expect(
      hasQueueFile({ details: { attachments: [{ originalFilename: 'a.pdf' }] } })
    ).toBe(true);
  });

  it('false เมื่อไม่มี attachment — แม้ originalFilename/storageTempPath จะมี (ไฟล์ resolve ไม่เจอ)', () => {
    expect(
      hasQueueFile({
        details: null,
        originalFilename: 'expect.pdf',
        storageTempPath: 'expect.pdf',
      })
    ).toBe(false);
  });
});

describe('getQueueFileName', () => {
  it('เลือก main attachment (isMainDocument) ก่อน', () => {
    const item = {
      details: {
        attachments: [
          { originalFilename: 'extra.pdf', isMainDocument: false },
          { originalFilename: 'main.pdf', isMainDocument: true },
        ],
      },
      originalFilename: 'register-name.pdf',
    };
    expect(getQueueFileName(item)).toBe('main.pdf');
  });

  it('fallback เป็น attachment แรกเมื่อไม่มี isMainDocument', () => {
    const item = {
      details: { attachments: [{ originalFilename: 'first.pdf' }] },
    };
    expect(getQueueFileName(item)).toBe('first.pdf');
  });

  it('fallback เป็น originalFilename เมื่อไม่มี attachment (ชื่อที่ register อ้างถึง)', () => {
    const item = {
      details: null,
      originalFilename: 'I672-0187.pdf',
      storageTempPath: 'I672-0187.pdf',
    };
    expect(getQueueFileName(item)).toBe('I672-0187.pdf');
  });

  it('fallback เป็น basename ของ storageTempPath', () => {
    const item = {
      details: null,
      storageTempPath: '/staging/docs/files/O672-0222.pdf',
    };
    expect(getQueueFileName(item)).toBe('O672-0222.pdf');
  });

  it('คืน undefined เมื่อไม่มีข้อมูลชื่อไฟล์เลย', () => {
    expect(getQueueFileName({ details: null })).toBeUndefined();
    expect(
      getQueueFileName({
        details: { attachments: [] },
        originalFilename: '  ',
        storageTempPath: '',
      })
    ).toBeUndefined();
  });
});
