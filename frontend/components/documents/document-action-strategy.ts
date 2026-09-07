// File: components/documents/document-action-strategy.ts
// บันทึกการแก้ไข: Frontend strategy interface for document actions (Feature 253 — T009)

/**
 * Strategy interface สำหรับ document actions บน frontend
 * แต่ละ document type มี implementation ของตัวเอง — ใช้กับ shared action components
 */

/** ประเภทการกระทำที่ support */
export type DocumentActionType = 'cancel' | 'hardDelete' | 'metadataPatch';

/** ผลลัพธ์จาก document action API */
export interface DocumentActionResult {
  success: boolean;
  publicId: string;
  action: DocumentActionType;
  newVersion?: number;
  failedSideEffects?: string[];
}

/** Configuration สำหรับ document action แต่ละประเภท */
export interface DocumentActionConfig {
  /** i18n key สำหรับชื่อ document type ที่แสดงใน UI */
  displayName: string;
  /** API endpoint base path (e.g., '/api/v1/correspondences') */
  apiBasePath: string;
  /** สิทธิ์ที่ต้องการสำหรับ action นี้ */
  requiredPermission: string;
  /** field ที่แก้ไขได้ (3-tier) */
  patchableFields: {
    tier1: string[];
    tier2: string[];
    tier3: string[];
  };
  /** ข้อความยืนยันการกระทำ (i18n key) */
  confirmKey: string;
  /** ข้อความสำเร็จ (i18n key) */
  successKey: string;
  /** ข้อความล้มเหลว (i18n key) */
  failedKey: string;
}

/**
 * Strategy interface สำหรับ document actions บน frontend
 * implement โดยแต่ละ document type (Correspondence, RFA, Transmittal, Drawing, Circulation)
 */
export interface DocumentActionStrategy {
  /** คืนค่า config สำหรับ document type นี้ */
  getConfig(): DocumentActionConfig;

  /**
   * เรียก API ยกเลิกเอกสาร
   * @param publicId - publicId ของเอกสาร
   * @param reason - เหตุผลการยกเลิก (optional)
   */
  cancel(publicId: string, reason?: string): Promise<DocumentActionResult>;

  /**
   * เรียก API ลบถาวร
   * @param publicId - publicId ของเอกสาร
   */
  hardDelete(publicId: string): Promise<DocumentActionResult>;

  /**
   * เรียก API แก้ไข metadata
   * @param publicId - publicId ของเอกสาร
   * @param patch - ข้อมูลที่ต้องการ patch
   * @param version - version ปัจจุบัน (optimistic locking)
   */
  metadataPatch(
    publicId: string,
    patch: Record<string, string | number | boolean | null>,
    version: number,
  ): Promise<DocumentActionResult>;
}

/** Registry ของ document type configs */
const DOCUMENT_ACTION_CONFIGS: Record<string, DocumentActionConfig> = {
  CORRESPONDENCE: {
    displayName: 'document.type.correspondence',
    apiBasePath: '/api/v1/correspondences',
    requiredPermission: 'correspondence.cancel',
    patchableFields: {
      tier1: ['subject', 'description', 'remarks', 'tags'],
      tier2: ['originatorId', 'disciplineId'],
      tier3: ['correspondenceNumber'],
    },
    confirmKey: 'document.cancel.confirm',
    successKey: 'document.cancel.success',
    failedKey: 'document.cancel.failed',
  },
  RFA: {
    displayName: 'document.type.rfa',
    apiBasePath: '/api/v1/rfas',
    requiredPermission: 'rfa.cancel',
    patchableFields: {
      tier1: ['subject', 'description', 'remarks'],
      tier2: ['rfaTypeId'],
      tier3: ['rfaNumber'],
    },
    confirmKey: 'document.cancel.confirm',
    successKey: 'document.cancel.success',
    failedKey: 'document.cancel.failed',
  },
  TRANSMITTAL: {
    displayName: 'document.type.transmittal',
    apiBasePath: '/api/v1/transmittals',
    requiredPermission: 'transmittal.cancel',
    patchableFields: {
      tier1: ['subject', 'remarks'],
      tier2: ['purpose'],
      tier3: [],
    },
    confirmKey: 'document.cancel.confirm',
    successKey: 'document.cancel.success',
    failedKey: 'document.cancel.failed',
  },
  DRAWING: {
    displayName: 'document.type.drawing',
    // หมายเหตุ: endpoints ถูก implement บน contract drawing controller (drawings/contract)
    apiBasePath: '/api/v1/drawings/contract',
    requiredPermission: 'drawing.cancel',
    patchableFields: {
      tier1: ['title', 'description'],
      tier2: ['mainCategoryId', 'subCategoryId'],
      tier3: ['drawingNumber'],
    },
    confirmKey: 'document.cancel.confirm',
    successKey: 'document.cancel.success',
    failedKey: 'document.cancel.failed',
  },
  CIRCULATION: {
    displayName: 'document.type.circulation',
    apiBasePath: '/api/v1/circulations',
    requiredPermission: 'circulation.close',
    patchableFields: {
      tier1: ['subject', 'deadlineDate'],
      tier2: ['organizationId'],
      tier3: [],
    },
    confirmKey: 'document.cancel.confirm',
    successKey: 'document.cancel.success',
    failedKey: 'document.cancel.failed',
  },
};

/**
 * คืนค่า DocumentActionConfig สำหรับ document type ที่กำหนด
 */
export function getDocumentActionConfig(
  documentType: string,
): DocumentActionConfig {
  const config = DOCUMENT_ACTION_CONFIGS[documentType];
  if (!config) {
    throw new Error(`Unknown document type: ${documentType}`);
  }
  return config;
}
