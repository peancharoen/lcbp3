// File: src/types/dto/master/correspondence-type.dto.ts

export interface CreateCorrespondenceTypeDto {
  /** ชื่อประเภทเอกสาร (เช่น 'Letter', 'RFA') */
  typeName: string;

  /** รหัสประเภทเอกสาร (เช่น 'LTR', 'RFA') */
  typeCode: string;

  /** มีการออกเลขเอกสารอัตโนมัติหรือไม่ */
  hasNumbering?: boolean;

  /** สถานะการใช้งาน (Default: true) */
  isActive?: boolean;
}

export type UpdateCorrespondenceTypeDto = Partial<CreateCorrespondenceTypeDto>;

export interface SearchCorrespondenceTypeDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
