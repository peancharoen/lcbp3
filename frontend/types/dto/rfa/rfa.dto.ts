// File: src/types/dto/rfa/rfa.dto.ts

// --- Create ---
export interface CreateRfaDto {
  /** ID or UUID ของโครงการ */
  projectId: number | string; // ADR-019: Accept UUID

  /** ประเภท RFA (เช่น DWG, MAT) - ADR-019: Accept UUID */
  rfaTypeId: number | string;

  /** [Req 6B] สาขางาน (จำเป็นสำหรับการรันเลข RFA) - ADR-019: Accept UUID */
  disciplineId?: number | string;

  /** หัวข้อเรื่อง */
  subject: string;

  /** เนื้อหา (Rich Text) */
  body?: string;

  /** หมายเหตุ */
  remarks?: string;

  /** Contract UUID (optional) */
  contractId?: string; // ADR-019: Contract UUID

  /** ส่งถึงใคร (สำหรับ Routing Step 1) */
  toOrganizationId: number | string; // ADR-019: Accept UUID

  /** รายละเอียดเพิ่มเติม */
  description?: string;

  /** วันที่ในเอกสาร (ISO Date String) */
  documentDate?: string;

  /** กำหนดวันตอบกลับ (ISO Date String) */
  dueDate?: string;

  /** รายการ ID หรือ UUID ของ Shop Drawing Revisions ที่แนบมา (ถ้ามี) */
  shopDrawingRevisionIds?: Array<number | string>;

  /** รายการ ID หรือ UUID ของ As-Built Drawing Revisions ที่แนบมา (ถ้ามี) */
  asBuiltDrawingRevisionIds?: Array<number | string>;
}

// --- Update (Partial) ---
export type UpdateRfaDto = Partial<CreateRfaDto>;

// --- Search ---
export interface SearchRfaDto {
  /** Filter by Project ID or UUID (optional to allow cross-project search) */
  projectId?: number | string; // ADR-019: Accept UUID

  /** กรองตามประเภท RFA - ADR-019: Accept UUID */
  rfaTypeId?: number | string;

  /** กรองตามสถานะ (เช่น Draft, For Approve) - ADR-019: Accept UUID */
  statusId?: number | string;

  /** กรองตามสถานะ code โดยตรง (เช่น 'DFT', 'FAP', 'FRE') */
  statusCode?: string;

  /** ค้นหาจาก เลขที่เอกสาร หรือ หัวข้อเรื่อง */
  search?: string;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  pageSize?: number;

  /** Revision Status Filter */
  revisionStatus?: 'CURRENT' | 'ALL' | 'OLD';
}
