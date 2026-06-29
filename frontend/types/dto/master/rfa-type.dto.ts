// File: src/types/dto/master/rfa-type.dto.ts

export interface CreateRfaTypeDto {
  /** ชื่อประเภท RFA (เช่น 'Drawing Approval') */
  typeName: string;

  /** รหัสประเภท RFA (เช่น 'DWG', 'MAT') */
  typeCode: string;

  /** สถานะการใช้งาน (Default: true) */
  isActive?: boolean;
}

export type UpdateRfaTypeDto = Partial<CreateRfaTypeDto>;

export interface SearchRfaTypeDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
