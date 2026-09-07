// File: backend/src/common/interfaces/action-result.interface.ts
// บันทึกการแก้ไข: Internal result shape for document actions (Feature 253)

/**
 * ผลลัพธ์ของ side effects สำหรับใช้ภายใน service
 */
export interface SideEffectsResult {
  searchReindexed: boolean;
  notificationsSent: number;
  workflowTerminated: boolean;
  circulationsClosed: number;
  vectorsDeleted: 'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED';
  filesDeleted: number;
}

/**
 * ผลลัพธ์การกระทำเอกสารภายใน service (ก่อน map เป็น response DTO)
 */
export interface ActionResult {
  success: boolean;
  publicId: string;
  action: 'CANCEL' | 'HARD_DELETE' | 'METADATA_PATCH';
  sideEffects: SideEffectsResult;
  failedSideEffects: string[];
  auditId?: string;
}
