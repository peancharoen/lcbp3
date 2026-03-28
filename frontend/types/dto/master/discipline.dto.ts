// File: src/types/dto/master/discipline.dto.ts

export interface CreateDisciplineDto {
  contractId: number | string; // ADR-019: Accept UUID

  /** รหัสสาขา (เช่น 'STR', 'ARC') */
  disciplineCode: string;

  codeNameTh?: string;

  codeNameEn?: string;

  isActive?: boolean;
}
