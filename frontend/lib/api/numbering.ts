import { NumberingTemplate, NumberingSequence, CreateTemplateDto, TestGenerationResult } from "@/types/numbering";

// Mock Data
let mockTemplates: NumberingTemplate[] = [
  {
    template_id: 1,
    document_type_id: "correspondence",
    document_type_name: "Correspondence",
    discipline_code: "",
    template_format: "{ORG}-CORR-{YYYY}-{SEQ}",
    example_number: "PAT-CORR-2025-0001",
    current_number: 125,
    reset_annually: true,
    padding_length: 4,
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    template_id: 2,
    document_type_id: "rfa",
    document_type_name: "RFA",
    discipline_code: "STR",
    template_format: "{ORG}-RFA-STR-{YYYY}-{SEQ}",
    example_number: "ITD-RFA-STR-2025-0042",
    current_number: 42,
    reset_annually: true,
    padding_length: 4,
    is_active: true,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockSequences: NumberingSequence[] = [
  {
    sequence_id: 1,
    template_id: 1,
    year: 2025,
    organization_code: "PAT",
    current_number: 125,
    last_generated_number: "PAT-CORR-2025-0125",
    updated_at: new Date().toISOString(),
  },
  {
    sequence_id: 2,
    template_id: 2,
    year: 2025,
    organization_code: "ITD",
    discipline_code: "STR",
    current_number: 42,
    last_generated_number: "ITD-RFA-STR-2025-0042",
    updated_at: new Date().toISOString(),
  },
];

export const numberingApi = {
  getTemplates: async (): Promise<NumberingTemplate[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockTemplates];
  },

  getTemplate: async (id: number): Promise<NumberingTemplate | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockTemplates.find((t) => t.template_id === id);
  },

  createTemplate: async (data: CreateTemplateDto): Promise<NumberingTemplate> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newTemplate: NumberingTemplate = {
      template_id: Math.max(...mockTemplates.map((t) => t.template_id)) + 1,
      document_type_name: data.document_type_id.toUpperCase(), // Simplified
      ...data,
      example_number: "TEST-0001", // Simplified
      current_number: data.starting_number - 1,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    mockTemplates.push(newTemplate);
    return newTemplate;
  },

  updateTemplate: async (id: number, data: Partial<CreateTemplateDto>): Promise<NumberingTemplate> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const index = mockTemplates.findIndex((t) => t.template_id === id);
    if (index === -1) throw new Error("Template not found");

    const updatedTemplate = { ...mockTemplates[index], ...data, updated_at: new Date().toISOString() };
    mockTemplates[index] = updatedTemplate;
    return updatedTemplate;
  },

  getSequences: async (templateId: number): Promise<NumberingSequence[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return mockSequences.filter((s) => s.template_id === templateId);
  },

  testTemplate: async (templateId: number, data: any): Promise<TestGenerationResult> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const template = mockTemplates.find(t => t.template_id === templateId);
    if (!template) throw new Error("Template not found");

    // Mock generation logic
    let number = template.template_format;
    number = number.replace("{ORG}", data.organization_id === "1" ? "PAT" : "ITD");
    number = number.replace("{DOCTYPE}", template.document_type_id.toUpperCase());
    number = number.replace("{DISC}", data.discipline_id === "1" ? "STR" : "ARC");
    number = number.replace("{YYYY}", data.year.toString());
    number = number.replace("{SEQ}", "0001");

    return { number };
  },
};
