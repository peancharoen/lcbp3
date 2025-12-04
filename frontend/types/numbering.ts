export interface NumberingTemplate {
  template_id: number;
  document_type_id: string;
  document_type_name: string;
  discipline_code?: string;
  template_format: string;
  example_number: string;
  current_number: number;
  reset_annually: boolean;
  padding_length: number;
  is_active: boolean;
  updated_at: string;
}

export interface NumberingSequence {
  sequence_id: number;
  template_id: number;
  year: number;
  organization_code?: string;
  discipline_code?: string;
  current_number: number;
  last_generated_number: string;
  updated_at: string;
}

export interface CreateTemplateDto {
  document_type_id: string;
  discipline_code?: string;
  template_format: string;
  reset_annually: boolean;
  padding_length: number;
  starting_number: number;
}

export interface TestGenerationResult {
  number: string;
}
