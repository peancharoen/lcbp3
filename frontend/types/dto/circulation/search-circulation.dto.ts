// File: src/types/dto/circulation/search-circulation.dto.ts

export interface SearchCirculationDto {
  /** ค้นหาจาก Subject หรือ No. */
  search?: string;

  /** OPEN, COMPLETED, CANCELLED */
  status?: string;

  /** กรองตาม correspondence publicId (ADR-019) */
  correspondencePublicId?: string;
  documentNumber?: string;
  createdDate?: string;
  sortBy?: 'documentNumber' | 'createdAt' | 'status';
  sortOrder?: 'ASC' | 'DESC';

  page?: number;

  limit?: number;
}
