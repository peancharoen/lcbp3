// File: backend/src/common/file-storage/file-magic-bytes.util.ts
// Change Log:
// - 2026-08-17: Initial creation — Magic bytes validation สำหรับ file upload (Issue #3, Phase 2.3)
//   ป้องกัน MIME spoofing โดยตรวจสอบ magic bytes จริงในไฟล์แทนการ trust client MIME header

/**
 * Magic bytes signature สำหรับแต่ละ file type
 * อ้างอิง: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
interface FileSignature {
  /** ค่า offset ที่เริ่มอ่าน magic bytes (default 0) */
  offset: number;
  /** magic bytes ที่ต้องตรง (แบบ exact หรือตรวจเฉพาะ prefix) */
  bytes: number[];
}

interface FileTypeRule {
  /** นามสกุลไฟล์ที่คาดหวัง (ไม่มีจุด) */
  extension: string;
  /** MIME type ที่จะคืนถ้า magic bytes ตรง */
  mimeType: string;
  /** รายการ signatures ที่ยอมรับ (OR — ตรงอย่างใดอย่างหนึ่งก็พอ) */
  signatures: FileSignature[];
}

/**
 * รายการ file types ที่อนุญาต พร้อม magic bytes signatures
 * ใช้สำหรับ validate ไฟล์จริง ไม่ trust MIME header จาก client
 */
export const FILE_TYPE_RULES: readonly FileTypeRule[] = [
  {
    extension: 'pdf',
    mimeType: 'application/pdf',
    signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },
  {
    extension: 'docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // DOCX/XLSX/ZIP ใช้ PK signature เดียวกัน (ZIP-based OOXML)
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK\x03\x04
  },
  {
    extension: 'xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK\x03\x04
  },
  {
    extension: 'zip',
    mimeType: 'application/zip',
    signatures: [
      { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK\x03\x04
      { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty zip
      { offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] }, // spanned zip
    ],
  },
  {
    extension: 'doc',
    mimeType: 'application/msword',
    // DOC (legacy) — D0 CF 11 E0 A1 B1 1A E1 (Compound File Binary)
    signatures: [
      { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    ],
  },
  {
    extension: 'xls',
    mimeType: 'application/vnd.ms-excel',
    signatures: [
      { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    ],
  },
  {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    signatures: [
      { offset: 0, bytes: [0xff, 0xd8, 0xff] }, // JPEG SOI + marker
    ],
  },
  {
    extension: 'jpeg',
    mimeType: 'image/jpeg',
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    extension: 'png',
    mimeType: 'image/png',
    signatures: [
      { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    ],
  },
  // DWG — magic bytes แตกต่างกันตามเวอร์ชัน
  // AC10xx (R1.0+) — ตรวจเฉพาะ prefix "AC" เพื่อครอบคลุมหลายเวอร์ชัน
  {
    extension: 'dwg',
    mimeType: 'image/vnd.dwg',
    signatures: [
      { offset: 0, bytes: [0x41, 0x43, 0x31, 0x30] }, // AC10 (R1.0–R14)
      { offset: 0, bytes: [0x41, 0x43, 0x31, 0x30, 0x30] }, // AC100
    ],
  },
] as const;

/**
 * ตรวจสอบ magic bytes ของไฟล์เพื่อยืนยันประเภทจริง
 * @param buffer ข้อมูลไฟล์ (อย่างน้อย 16 bytes แรก)
 * @param expectedExtension นามสกุลไฟล์ที่คาดหวัง (ไม่มีจุด) เช่น "pdf"
 * @returns true ถ้า magic bytes ตรงกับ expectedExtension
 */
export function validateMagicBytes(
  buffer: Buffer,
  expectedExtension: string
): boolean {
  const ext = expectedExtension.toLowerCase().replace(/^\./, '');
  const rule = FILE_TYPE_RULES.find((r) => r.extension === ext);
  if (!rule) {
    // ถ้าไม่มี rule สำหรับ extension นี้ ให้ผ่าน (เช่น DWG ที่ไม่มีใน rules)
    // — ไม่ block การทำงาน แต่ log warning ที่ caller
    return true;
  }

  if (buffer.length < 16) {
    return false;
  }

  return rule.signatures.some((sig) => {
    if (buffer.length < sig.offset + sig.bytes.length) return false;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) return false;
    }
    return true;
  });
}

/**
 * ตรวจจับ MIME type จริงจาก magic bytes (เพื่อ override client-supplied MIME)
 * @param buffer ข้อมูลไฟล์ (อย่างน้อย 16 bytes แรก)
 * @returns MIME type ที่ตรวจพบ หรือ null ถ้าไม่ตรง rule ใดๆ
 */
export function detectMimeTypeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 16) return null;

  for (const rule of FILE_TYPE_RULES) {
    const matched = rule.signatures.some((sig) => {
      if (buffer.length < sig.offset + sig.bytes.length) return false;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) return false;
      }
      return true;
    });
    if (matched) {
      return rule.mimeType;
    }
  }
  return null;
}

/**
 * Validate ไฟล์ทั้งหมด: extension + magic bytes + MIME consistency
 * @param buffer ข้อมูลไฟล์
 * @param filename ชื่อไฟล์ (มีนามสกุล)
 * @param clientMimeType MIME type ที่ client รายงาน
 * @returns object ที่บอกว่า valid หรือไม่ พร้อม detected MIME
 */
export function validateFileType(
  buffer: Buffer,
  filename: string,
  clientMimeType: string
): { valid: boolean; detectedMimeType: string | null; reason?: string } {
  const ext = path.extname(filename).slice(1).toLowerCase();

  if (!ext) {
    return {
      valid: false,
      detectedMimeType: null,
      reason: 'File extension missing',
    };
  }

  // ตรวจ magic bytes ตรงกับ extension ที่ claim
  const magicValid = validateMagicBytes(buffer, ext);
  if (!magicValid) {
    const detected = detectMimeTypeFromMagicBytes(buffer);
    return {
      valid: false,
      detectedMimeType: detected,
      reason: `Magic bytes do not match extension ".${ext}"${
        detected ? ` (detected: ${detected})` : ''
      }`,
    };
  }

  // ตรวจ MIME consistency — client MIME ต้องตรงกับ detected MIME (ถ้ามี)
  const detected = detectMimeTypeFromMagicBytes(buffer);
  if (detected && clientMimeType && clientMimeType !== detected) {
    // ยอมให้ client MIME ต่างจาก detected ถ้าเป็น DWG (browser รายงานไม่สม่ำเสมอ)
    const isDwg =
      ext === 'dwg' ||
      clientMimeType.includes('dwg') ||
      detected.includes('dwg');
    if (!isDwg) {
      return {
        valid: false,
        detectedMimeType: detected,
        reason: `MIME type mismatch: client="${clientMimeType}" actual="${detected}"`,
      };
    }
  }

  return { valid: true, detectedMimeType: detected };
}

// path จำเป็นต้อง import สำหรับ path.extname
import * as path from 'path';
