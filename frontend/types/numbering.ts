// Re-export types from API file to keep single source of truth
export type { NumberingTemplate, NumberSequence } from "@/lib/api/numbering";

export interface CreateTemplateDto {
  documentTypeId: string;
  disciplineCode?: string;
  templateFormat: string;
  resetAnnually: boolean;
  paddingLength: number;
  startingNumber: number;
}

export interface TestGenerationResult {
  number: string;
}
