// File: backend/src/modules/migration/constants/dwg-exclusion.constant.ts
// Change Log:
// - 2026-08-06: Initial creation — shared DWG exclusion predicate (Feature 242, R5, FR-015, FR-022)

/**
 * MIME types ของไฟล์ DWG ที่ต้องข้ามในการเปรียบเทียบและ RAG embedding (R5)
 * browsers และ upload tools รายงาน DWG ไม่สม่ำเสมอ — จึงต้องมี extension fallback ด้วย
 */
export const DWG_MIME_TYPES: readonly string[] = [
  'image/vnd.dwg',
  'application/acad',
  'application/x-acad',
  'application/dwg',
  'drawing/dwg',
] as const;

/**
 * นามสกุลไฟล์ที่ไม่มี text layer ใช้ OCR ไม่ได้ (R5)
 * .dxf เป็น interchange twin ของ .dwg — ไม่มี text layer เช่นกัน
 */
export const DWG_EXTENSIONS: readonly string[] = ['.dwg', '.dxf'] as const;

/**
 * ตรวจสอบว่าไฟล์เป็น DWG/DXF (ไม่มี text layer) หรือไม่ (R5)
 * ตรวจทั้ง MIME type และ extension fallback เพื่อจับกรณี application/octet-stream
 * @param mimeType MIME type ของไฟล์
 * @param originalFilename ชื่อไฟล์เดิม
 * @returns true เมื่อไฟล์เป็น DWG/DXF ที่ต้องข้าม
 */
export const isDwgFile = (
  mimeType: string | null | undefined,
  originalFilename: string | null | undefined
): boolean => {
  if (mimeType && DWG_MIME_TYPES.includes(mimeType)) {
    return true;
  }
  if (!originalFilename) return false;
  const lower = originalFilename.toLowerCase();
  return DWG_EXTENSIONS.some((ext) => lower.endsWith(ext));
};
