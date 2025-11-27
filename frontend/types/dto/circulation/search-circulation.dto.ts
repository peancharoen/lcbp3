// File: src/types/dto/circulation/search-circulation.dto.ts

export interface SearchCirculationDto {
  /** ค้นหาจาก Subject หรือ No. */
  search?: string; 

  /** OPEN, COMPLETED, CANCELLED */
  status?: string; 

  page?: number;

  limit?: number;
}