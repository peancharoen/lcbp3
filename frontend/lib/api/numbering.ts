// Types
export interface NumberingTemplate {
  templateId: number;
  projectId?: number;
  documentTypeId?: string;
  documentTypeName: string;
  disciplineCode?: string;
  templateFormat: string;
  exampleNumber: string;
  currentNumber: number;
  resetAnnually: boolean;
  paddingLength: number;
  isActive: boolean;
}

export interface NumberSequence {
  sequenceId: number;
  year: number;
  organizationCode?: string;
  disciplineCode?: string;
  currentNumber: number;
  lastGeneratedNumber: string;
  updatedAt: string;
}

// Mock Data
const mockTemplates: NumberingTemplate[] = [
  {
    templateId: 1,
    projectId: 1,
    documentTypeName: 'Correspondence',
    disciplineCode: '',
    templateFormat: '{ORIGINATOR}-{RECIPIENT}-{SEQ:4}-{YEAR:B.E.}',
    exampleNumber: 'PAT-CN-0001-2568',
    currentNumber: 142,
    resetAnnually: true,
    paddingLength: 4,
    isActive: true,
  },
  {
    templateId: 2,
    projectId: 1,
    documentTypeName: 'RFA',
    disciplineCode: 'STR',
    templateFormat: '{PROJECT}-{CORR_TYPE}-{DISCIPLINE}-{RFA_TYPE}-{SEQ:4}-{REV}',
    exampleNumber: 'LCBP3-RFA-STR-SDW-0056-A',
    currentNumber: 56,
    resetAnnually: true,
    paddingLength: 4,
    isActive: true,
  },
  {
    templateId: 3,
    projectId: 2,
    documentTypeName: 'Maintenance Request',
    disciplineCode: '',
    templateFormat: 'MAINT-{SEQ:4}',
    exampleNumber: 'MAINT-0001',
    currentNumber: 1,
    resetAnnually: true,
    paddingLength: 4,
    isActive: true,
  },
];

const mockSequences: NumberSequence[] = [
  {
    sequenceId: 1,
    year: 2025,
    organizationCode: 'PAT',
    currentNumber: 142,
    lastGeneratedNumber: 'PAT-CORR-2025-0142',
    updatedAt: new Date().toISOString(),
  },
  {
    sequenceId: 2,
    year: 2025,
    disciplineCode: 'STR',
    currentNumber: 56,
    lastGeneratedNumber: 'RFA-STR-2025-0056',
    updatedAt: new Date().toISOString(),
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
        setTimeout(() => resolve(mockTemplates.find(t => t.templateId === id)), 300);
     });
  },

  saveTemplate: async (template: Partial<NumberingTemplate>): Promise<NumberingTemplate> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (template.templateId) {
           // Update
           const index = mockTemplates.findIndex(t => t.templateId === template.templateId);
           if (index !== -1) {
               mockTemplates[index] = { ...mockTemplates[index], ...template } as NumberingTemplate;
               resolve(mockTemplates[index]);
          }
        } else {
           // Create
           const newTemplate: NumberingTemplate = {
               templateId: Math.floor(Math.random() * 1000),
               documentTypeName: 'New Type',
               isActive: true,
               currentNumber: 0,
               exampleNumber: 'PREVIEW',
               templateFormat: template.templateFormat || '',
               disciplineCode: template.disciplineCode,
               paddingLength: template.paddingLength ?? 4,
               resetAnnually: template.resetAnnually ?? true,
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

  generateTestNumber: async (templateId: number, context: { organizationId: string, disciplineId: string }): Promise<{ number: string }> => {
      return new Promise((resolve) => {
          setTimeout(() => {
              const template = mockTemplates.find(t => t.templateId === templateId);
              if (!template) return resolve({ number: 'ERROR' });

              let format = template.templateFormat;
              // Mock replacement
              format = format.replace('{PROJECT}', 'LCBP3');
              format = format.replace('{ORIGINATOR}', context.organizationId === '1' ? 'PAT' : 'CN');
              format = format.replace('{RECIPIENT}', context.organizationId === '1' ? 'CN' : 'PAT');
              format = format.replace('{CORR_TYPE}', template.documentTypeName === 'Correspondence' ? 'CORR' : 'RFA');
              format = format.replace('{DISCIPLINE}', context.disciplineId === '1' ? 'STR' : (context.disciplineId === '2' ? 'ARC' : 'GEN'));
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
