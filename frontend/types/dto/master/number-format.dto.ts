// File: src/types/dto/master/number-format.dto.ts

export interface SaveNumberFormatDto {
  projectId: number;

  correspondenceTypeId: number;

  /** รูปแบบ Template เช่น '{ORG}-{TYPE}-{DISCIPLINE}-{SEQ:4}' */
  formatTemplate: string;
}