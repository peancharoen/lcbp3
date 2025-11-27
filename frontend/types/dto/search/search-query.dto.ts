// File: src/types/dto/search/search-query.dto.ts

export interface SearchQueryDto {
  /** คำค้นหา (Query) */
  q?: string;

  /** กรองประเภท: 'rfa', 'correspondence', 'drawing' */
  type?: string;

  /** ID ของโครงการ */
  projectId?: number;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  limit?: number;
}