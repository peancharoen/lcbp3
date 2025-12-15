import apiClient from '@/lib/api/client';

// Types
export interface NumberingTemplate {
  id?: number; // Backend uses 'id'
  templateId?: number; // Legacy, optional
  projectId: number;
  correspondenceTypeId: number;
  correspondenceType?: { typeCode: string; typeName: string }; // Relation
  documentTypeName?: string; // Optional (joined)
  disciplineId: number;
  discipline?: { disciplineCode: string; disciplineName: string }; // Relation
  disciplineCode?: string; // Optional (joined)
  formatTemplate: string; // Backend uses 'formatTemplate'
  templateFormat?: string; // Legacy alias
  exampleNumber?: string;
  paddingLength: number;
  resetAnnually: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NumberingTemplateDto {
  projectId: number;
  correspondenceTypeId: number;
  disciplineId?: number; // 0 = All
  formatTemplate: string;
  exampleNumber?: string;
  paddingLength: number;
  resetAnnually: boolean;
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

export const numberingApi = {
  getTemplates: async (): Promise<NumberingTemplate[]> => {
    const res = await apiClient.get<NumberingTemplate[]>('/admin/document-numbering/templates');
    return res.data.map(t => ({
        ...t,
        templateId: t.id,
        templateFormat: t.formatTemplate,
        // Map joined data if available, else placeholders
        documentTypeName: t.correspondenceType?.typeCode || 'UNKNOWN',
        disciplineCode: t.discipline?.disciplineCode || 'ALL',
    }));
  },

  getTemplate: async (id: number): Promise<NumberingTemplate | undefined> => {
    // Currently no single get endpoint
    const templates = await numberingApi.getTemplates();
    return templates.find(t => t.id === id);
  },

  saveTemplate: async (template: Partial<NumberingTemplate>): Promise<NumberingTemplate> => {
     // Map frontend interface to backend entity DTO
     const payload = {
         id: template.id || template.templateId, // Update if ID exists
         projectId: template.projectId,
         correspondenceTypeId: template.correspondenceTypeId,
         disciplineId: template.disciplineId || 0,
         formatTemplate: template.templateFormat || template.formatTemplate,
         exampleNumber: template.exampleNumber,
         paddingLength: template.paddingLength,
         resetAnnually: template.resetAnnually,
         isActive: template.isActive ?? true
     };
     const res = await apiClient.post<NumberingTemplate>('/admin/document-numbering/templates', payload);
     return res.data;
  },

  getSequences: async (): Promise<NumberSequence[]> => {
       // TODO: Implement backend endpoint for sequences list
      return new Promise((resolve) => {
          setTimeout(() => resolve([]), 500);
      });
  },

  generateTestNumber: async (templateId: number, context: { organizationId: string, disciplineId: string }): Promise<{ number: string }> => {
      // Use preview endpoint
      // We need to know projectId, typeId etc from template.
      // But preview endpoint needs context.
      // For now, let's just return a mock or call preview endpoint if we have enough info.

      // eslint-disable-next-line no-console
      console.log('Generating test number for:', templateId, context);
      return new Promise((resolve) => resolve({ number: 'TEST-1234' }));
  },

  // --- Admin Tools ---

  getMetrics: async (): Promise<{ audit: any[], errors: any[] }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.get<{ audit: any[], errors: any[] }>('/admin/document-numbering/metrics');
      return res.data;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manualOverride: async (data: any): Promise<void> => {
      await apiClient.post('/admin/document-numbering/manual-override', data);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  voidAndReplace: async (data: any): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.post<any>('/admin/document-numbering/void-and-replace', data);
      return res.data;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancelNumber: async (data: any): Promise<void> => {
      await apiClient.post('/admin/document-numbering/cancel', data);
  },
};
