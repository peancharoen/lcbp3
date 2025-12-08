// Types
export interface NumberingTemplate {
  template_id: number;
  project_id?: number; // Added optional for flexibility in mock, generally required
  document_type_name: string; // e.g. Correspondence, RFA
  discipline_code?: string; // e.g. STR, ARC, NULL for all
  template_format: string; // e.g. {ORG}-{DOCTYPE}-{YYYY}-{SEQ}
  example_number: string;
  current_number: number;
  reset_annually: boolean;
  padding_length: number;
  is_active: boolean;
}

export interface NumberSequence {
  sequence_id: number;
  year: number;
  organization_code?: string;
  discipline_code?: string;
  current_number: number;
  last_generated_number: string;
  updated_at: string;
}

// Mock Data
const mockTemplates: NumberingTemplate[] = [
  {
    template_id: 1,
    project_id: 1, // LCBP3
    document_type_name: 'Correspondence',
    discipline_code: '',
    template_format: '{ORIGINATOR}-{RECIPIENT}-{SEQ:4}-{YEAR:B.E.}',
    example_number: 'PAT-CN-0001-2568',
    current_number: 142,
    reset_annually: true,
    padding_length: 4,
    is_active: true,
  },
  {
    template_id: 2,
    project_id: 1, // LCBP3
    document_type_name: 'RFA',
    discipline_code: 'STR',
    template_format: '{PROJECT}-{CORR_TYPE}-{DISCIPLINE}-{RFA_TYPE}-{SEQ:4}-{REV}',
    example_number: 'LCBP3-RFA-STR-SDW-0056-A',
    current_number: 56,
    reset_annually: true,
    padding_length: 4,
    is_active: true,
  },
  {
    template_id: 3,
    project_id: 2, // LCBP3-Maintenance
    document_type_name: 'Maintenance Request',
    discipline_code: '',
    template_format: 'MAINT-{SEQ:4}',
    example_number: 'MAINT-0001',
    current_number: 1,
    reset_annually: true,
    padding_length: 4,
    is_active: true,
  },
];

const mockSequences: NumberSequence[] = [
  {
    sequence_id: 1,
    year: 2025,
    organization_code: 'PAT',
    current_number: 142,
    last_generated_number: 'PAT-CORR-2025-0142',
    updated_at: new Date().toISOString(),
  },
  {
    sequence_id: 2,
    year: 2025,
    discipline_code: 'STR',
    current_number: 56,
    last_generated_number: 'RFA-STR-2025-0056',
    updated_at: new Date().toISOString(),
  },
];

export const numberingApi = {
  getTemplates: async (): Promise<NumberingTemplate[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockTemplates]), 500);
    });
  },

  getTemplate: async (id: number): Promise<NumberingTemplate | undefined> => {
     return new Promise((resolve) => {
        setTimeout(() => resolve(mockTemplates.find(t => t.template_id === id)), 300);
     });
  },

  saveTemplate: async (template: Partial<NumberingTemplate>): Promise<NumberingTemplate> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (template.template_id) {
           // Update
           const index = mockTemplates.findIndex(t => t.template_id === template.template_id);
           if (index !== -1) {
               mockTemplates[index] = { ...mockTemplates[index], ...template } as NumberingTemplate;
               resolve(mockTemplates[index]);
           }
        } else {
           // Create
           const newTemplate: NumberingTemplate = {
               template_id: Math.floor(Math.random() * 1000),
               document_type_name: 'New Type',
               is_active: true,
               current_number: 0,
               example_number: 'PREVIEW',
               template_format: template.template_format || '',
               discipline_code: template.discipline_code,
               padding_length: template.padding_length ?? 4,
               reset_annually: template.reset_annually ?? true,
               ...template
           } as NumberingTemplate;
           mockTemplates.push(newTemplate);
           resolve(newTemplate);
        }
      }, 500);
    });
  },

  getSequences: async (): Promise<NumberSequence[]> => {
      return new Promise((resolve) => {
          setTimeout(() => resolve([...mockSequences]), 500);
      });
  },

  generateTestNumber: async (templateId: number, context: { organization_id: string, discipline_id: string }): Promise<{ number: string }> => {
      return new Promise((resolve) => {
          setTimeout(() => {
              const template = mockTemplates.find(t => t.template_id === templateId);
              if (!template) return resolve({ number: 'ERROR' });

              let format = template.template_format;
              // Mock replacement
              format = format.replace('{PROJECT}', 'LCBP3');
              format = format.replace('{ORIGINATOR}', context.organization_id === '1' ? 'PAT' : 'CN');
              format = format.replace('{RECIPIENT}', context.organization_id === '1' ? 'CN' : 'PAT');
              format = format.replace('{CORR_TYPE}', template.document_type_name === 'Correspondence' ? 'CORR' : 'RFA');
              format = format.replace('{DISCIPLINE}', context.discipline_id === '1' ? 'STR' : (context.discipline_id === '2' ? 'ARC' : 'GEN'));
              format = format.replace('{RFA_TYPE}', 'SDW'); // Mock

              const year = new Date().getFullYear();
              format = format.replace('{YEAR:A.D.}', year.toString());
              format = format.replace('{YEAR:B.E.}', (year + 543).toString());
              format = format.replace('{SEQ:4}', '0001');
              format = format.replace('{REV}', 'A');

              resolve({ number: format });
          }, 800);
      });
  }
};
