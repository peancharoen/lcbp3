// File: src/types/dto/correspondence/search-correspondence.dto.ts

export interface SearchCorrespondenceDto {
  search?: string; // ค้นหาจาก Title หรือ Number
  typeId?: number | string; // ADR-019: Accept UUID - กรองตามประเภทเอกสาร
  projectId?: number | string; // ADR-019: Accept UUID - กรองตามโครงการ
  statusId?: number | string; // ADR-019: Accept UUID - กรองตามสถานะ (จาก Revision ปัจจุบัน)
  status?: string; // กรองตามสถานะ code string (เช่น DRAFT, IN_REVIEW)
  revisionStatus?: 'CURRENT' | 'ALL' | 'OLD'; // กรองตามสถานะ Revision

  // เพิ่มเติมสำหรับการแบ่งหน้า (Pagination)
  page?: number;
  limit?: number;
}
