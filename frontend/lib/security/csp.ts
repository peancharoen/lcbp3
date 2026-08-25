// File: frontend/lib/security/csp.ts
// Change Log:
// - 2026-08-25: Initial creation — แยก CSP generation ออกจาก proxy.ts เพื่อให้ test ได้ (D160)

/**
 * สร้าง Content-Security-Policy header string จาก nonce
 *
 * ใช้ Nonce Strategy เพื่ออนุญาต Inline Script เฉพาะที่ระบุตัวตนได้ ป้องกัน XSS
 * API ผ่าน NPM proxy (same-origin) — connect-src 'self' ครอบอยู่แล้ว
 * ไม่ต้องเพิ่ม origin แยกอีก และไม่ใช้ upgrade-insecure-requests
 * เพราะ backend หลัง proxy เป็น HTTP แต่ browser เห็นเป็น HTTPS ผ่าน NPM
 *
 * @param nonce - base64-encoded nonce สำหรับ script-src 'nonce-...' directive
 * @returns CSP header string พร้อม semicolon-separated directives
 */
export function generateCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' http: https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ws: wss:`,
    // Monaco Editor Web Workers ต้องการ blob: URL สำหรับ inline workers
    "worker-src 'self' blob:",
    // D160: อนุญาต blob: URL ใน iframe สำหรับ StagingFileViewer และ FilePreviewModal
    // ที่ดึงไฟล์ผ่าน apiClient (JWT) แล้วแปลงเป็น BlobURL ก่อนเซ็ตเป็น iframe src
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
