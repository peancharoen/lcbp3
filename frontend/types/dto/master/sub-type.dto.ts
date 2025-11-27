// File: src/types/dto/master/sub-type.dto.ts

export interface CreateSubTypeDto {
  contractId: number;

  correspondenceTypeId: number;

  /** รหัสย่อย (เช่น 'MAT') */
  subTypeCode: string;

  subTypeName?: string;

  /** เลขรหัสสำหรับ Running Number (เช่น '11') */
  subTypeNumber?: string;
}