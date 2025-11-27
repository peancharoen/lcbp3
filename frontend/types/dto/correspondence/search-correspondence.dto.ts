// File: src/types/dto/correspondence/search-correspondence.dto.ts

export interface SearchCorrespondenceDto {
  search?: string;      // ค้นหาจาก Title หรือ Number
  typeId?: number;      // กรองตามประเภทเอกสาร
  projectId?: number;   // กรองตามโครงการ
  statusId?: number;    // กรองตามสถานะ (จาก Revision ปัจจุบัน)
  
  // เพิ่มเติมสำหรับการแบ่งหน้า (Pagination)
  page?: number;
  limit?: number;
}