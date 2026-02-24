// File: src/types/dto/drawing/contract-drawing.dto.ts

// --- Create ---
export interface CreateContractDrawingDto {
  /** ID ของโครงการ */
  projectId: number;

  /** เลขที่แบบสัญญา */
  contractDrawingNo: string;

  /** ชื่อแบบ */
  title: string;

  /** ID หมวดหมู่ย่อย (Mapping) */
  mapCatId?: number;

  /** ID เล่มของแบบ */
  volumeId?: number;

  /** เลขหน้าในเล่ม */
  volumePage?: number;

  /** รายการ ID ของไฟล์แนบ (PDF/DWG) */
  attachmentIds?: number[];
}

// --- Update (Partial) ---
export type UpdateContractDrawingDto = Partial<CreateContractDrawingDto>;

// --- Search ---
export interface SearchContractDrawingDto {
  /** จำเป็นต้องระบุ Project ID เสมอ */
  projectId: number;

  volumeId?: number;
  mapCatId?: number;
  search?: string; // ค้นหาจาก Title หรือ Number

  page?: number;     // Default: 1
  pageSize?: number; // Default: 20
}
