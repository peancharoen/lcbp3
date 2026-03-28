// File: src/types/dto/drawing/contract-drawing.dto.ts

// --- Create ---
export interface CreateContractDrawingDto {
  /** ID ของโครงการ - ADR-019: Accept UUID */
  projectId: number | string;

  /** เลขที่แบบสัญญา */
  contractDrawingNo: string;

  /** ชื่อแบบ */
  title: string;

  /** ID หมวดหมู่ย่อย (Mapping) - ADR-019: Accept UUID */
  mapCatId?: number | string;

  /** ID เล่มของแบบ - ADR-019: Accept UUID */
  volumeId?: number | string;

  /** เลขหน้าในเล่ม */
  volumePage?: number;

  /** รายการ ID ของไฟล์แนบ (PDF/DWG) - ADR-019: Accept UUID */
  attachmentIds?: (number | string)[];
}

// --- Update (Partial) ---
export type UpdateContractDrawingDto = Partial<CreateContractDrawingDto>;

// --- Search ---
export interface SearchContractDrawingDto {
  /** จำเป็นต้องระบุ Project UUID เสมอ */
  projectUuid: string;

  volumeId?: number | string; // ADR-019: Accept UUID
  mapCatId?: number | string; // ADR-019: Accept UUID
  search?: string; // ค้นหาจาก Title หรือ Number

  page?: number; // Default: 1
  limit?: number; // Default: 20
}
