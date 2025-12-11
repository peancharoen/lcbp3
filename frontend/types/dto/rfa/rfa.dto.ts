// File: src/types/dto/rfa/rfa.dto.ts

// --- Create ---
export interface CreateRfaDto {
  /** ID ของโครงการ */
  projectId: number;

  /** ประเภท RFA (เช่น DWG, MAT) */
  rfaTypeId: number;

  /** [Req 6B] สาขางาน (จำเป็นสำหรับการรันเลข RFA) */
  disciplineId?: number;

  /** หัวข้อเรื่อง */
  title: string;

  /** ส่งถึงใคร (สำหรับ Routing Step 1) */
  toOrganizationId: number;

  /** รายละเอียดเพิ่มเติม */
  description?: string;

  /** วันที่ในเอกสาร (ISO Date String) */
  documentDate?: string;

  /** กำหนดวันตอบกลับ (ISO Date String) */
  dueDate?: string;

  /** รายการ ID ของ Shop Drawings ที่แนบมา (ถ้ามี) */
  shopDrawingRevisionIds?: number[];
}

// --- Update (Partial) ---
export interface UpdateRfaDto extends Partial<CreateRfaDto> {}

// --- Search ---
export interface SearchRfaDto {
  /** Filter by Project ID (optional to allow cross-project search) */
  projectId?: number;

  /** กรองตามประเภท RFA */
  rfaTypeId?: number;

  /** กรองตามสถานะ (เช่น Draft, For Approve) */
  statusId?: number;

  /** ค้นหาจาก เลขที่เอกสาร หรือ หัวข้อเรื่อง */
  search?: string;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  pageSize?: number;

  /** Revision Status Filter */
  revisionStatus?: 'CURRENT' | 'ALL' | 'OLD';
}
