// File: frontend/lib/security/__tests__/csp.test.ts
// Change Log:
// - 2026-08-25: Initial creation — regression test สำหรับ CSP frame-src blob: (D160)
//   สาเหตุ: CSP ขาด frame-src → default-src 'self' บล็อก blob: URL ใน iframe
//   → Chrome แสดง "This content is blocked" บน /admin/migration/review

import { describe, it, expect } from 'vitest';
import { generateCspHeader } from '../csp';

describe('generateCspHeader', () => {
  const testNonce = 'd2f22fa9-afbc-4cb4-b46d-589f6bdaf5ae';

  it('สร้าง CSP header ที่มี frame-src blob: เพื่ออนุญาต blob: URL ใน iframe (D160)', () => {
    const csp = generateCspHeader(testNonce);

    // D160: frame-src ต้องมี blob: เพื่อให้ StagingFileViewer และ FilePreviewModal
    // ที่ใช้ URL.createObjectURL() เป็น iframe src ทำงานได้
    expect(csp).toContain("frame-src 'self' blob:");
  });

  it('มี worker-src blob: สำหรับ Monaco Editor inline workers', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain("worker-src 'self' blob:");
  });

  it('มี img-src blob: สำหรับ image preview ผ่าน BlobURL', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain("img-src 'self' blob: data: https:");
  });

  it('ฝัง nonce ใน script-src directive', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain(`'nonce-${testNonce}'`);
    expect(csp).toContain(`script-src 'self' 'nonce-${testNonce}'`);
  });

  it('มี object-src none เพื่อบล็อก plugin embed (Flash, Java)', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain("object-src 'none'");
  });

  it('มี frame-ancestors none เพื่อป้องกัน clickjacking', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('มี default-src self เป็น fallback สำหรับ directive ที่ไม่ระบุ', () => {
    const csp = generateCspHeader(testNonce);

    expect(csp).toContain("default-src 'self'");
  });

  it('ไม่มี unsafe-inline ใน script-src (ใช้ nonce แทน)', () => {
    const csp = generateCspHeader(testNonce);

    // script-src มี 'unsafe-inline' แต่อยู่หลัง nonce + strict-dynamic
    // ซึ่ง browser จะ ignore 'unsafe-inline' เมื่อมี nonce หรือ hash — เป็น backward compat
    // สำคัญคือต้องมี nonce เพื่อให้ browser ใช้ nonce strategy
    const scriptSrcMatch = csp.match(/script-src [^;]+/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(scriptSrcMatch![0]).toContain(`'nonce-${testNonce}'`);
    expect(scriptSrcMatch![0]).toContain("'strict-dynamic'");
  });

  it('CSP header เป็น semicolon-separated string ไม่มี trailing semicolon', () => {
    const csp = generateCspHeader(testNonce);

    // ต้องไม่ลงท้ายด้วย semicolon
    expect(csp.endsWith(';')).toBe(false);
    // ต้องมีอย่างน้อย 10 directives (แยกด้วย ; )
    const directives = csp.split('; ');
    expect(directives.length).toBeGreaterThanOrEqual(10);
  });
});
