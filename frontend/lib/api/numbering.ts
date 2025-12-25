import apiClient from '@/lib/api/client';

// ============================================================
// Types - aligned with backend entities
// ============================================================

/**
 * Document Number Format/Template
 * Matches: backend/src/modules/document-numbering/entities/document-number-format.entity.ts
 */
export interface NumberingTemplate {
  id: number;
  projectId: number;
  correspondenceTypeId: number | null; // null = Default Format for project
  correspondenceType?: {
    id: number;
    typeCode: string;
    typeName: string;
  } | null;
  project?: {
    id: number;
    projectCode: string;
    projectName: string;
  };
  formatTemplate: string;
  description?: string;
  resetSequenceYearly: boolean; // Controls yearly counter reset
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DTO for creating/updating templates
 */
export interface SaveTemplateDto {
  id?: number; // If present, update; otherwise create
  projectId: number;
  correspondenceTypeId: number | null;
  formatTemplate: string;
  description?: string;
  resetSequenceYearly?: boolean;
}

/**
 * Document Number Audit Log
 * Matches: backend/src/modules/document-numbering/entities/document-number-audit.entity.ts
 */
export interface DocumentNumberAudit {
  id: number;
  documentId: number;
  generatedNumber: string;
  counterKey: Record<string, unknown>;
  templateUsed: string;
  operation: 'RESERVE' | 'CONFIRM' | 'MANUAL_OVERRIDE' | 'VOID_REPLACE' | 'CANCEL';
  metadata?: Record<string, unknown>;
  userId: number;
  ipAddress?: string;
  retryCount: number;
  lockWaitMs?: number;
  totalDurationMs?: number;
  fallbackUsed?: 'NONE' | 'DB_LOCK' | 'RETRY';
  createdAt: string;
}

/**
 * Document Number Error Log
 */
export interface DocumentNumberError {
  id: number;
  errorMessage: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  userId?: number;
  ipAddress?: string;
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Manual Override DTO
 */
export interface ManualOverrideDto {
  projectId: number;
  correspondenceTypeId: number | null;
  year: number;
  newValue: number;
}

/**
 * Void and Replace DTO
 */
export interface VoidAndReplaceDto {
  documentId: number;
  reason: string;
}

/**
 * Cancel Number DTO
 */
export interface CancelNumberDto {
  documentNumber: string;
  reason: string;
}

/**
 * Bulk Import Item
 */
export interface BulkImportItem {
  projectId: number;
  correspondenceTypeId: number | null;
  year: number;
  lastNumber: number;
}

// ============================================================
// API Client
// ============================================================

export const numberingApi = {
  // ----------------------------------------------------------
  // Template Management (Admin endpoints)
  // ----------------------------------------------------------

  /**
   * Get all templates
   */
  getTemplates: async (): Promise<NumberingTemplate[]> => {
    const res = await apiClient.get<NumberingTemplate[]>('/admin/document-numbering/templates');
    return res.data;
  },

  /**
   * Get templates for a specific project
   */
  getTemplatesByProject: async (projectId: number): Promise<NumberingTemplate[]> => {
    const res = await apiClient.get<NumberingTemplate[]>(
      `/admin/document-numbering/templates?projectId=${projectId}`
    );
    return res.data;
  },

  /**
   * Get single template by ID
   */
  getTemplate: async (id: number): Promise<NumberingTemplate | undefined> => {
    const templates = await numberingApi.getTemplates();
    return templates.find((t) => t.id === id);
  },

  /**
   * Save (create or update) a template
   */
  saveTemplate: async (dto: Partial<NumberingTemplate>): Promise<NumberingTemplate> => {
    const res = await apiClient.post<NumberingTemplate>(
      '/admin/document-numbering/templates',
      dto
    );
    return res.data;
  },

  /**
   * Delete a template
   */
  deleteTemplate: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/document-numbering/templates/${id}`);
  },

  // ----------------------------------------------------------
  // Logs (Requires system.view_logs permission)
  // ----------------------------------------------------------

  /**
   * Get audit logs
   */
  getAuditLogs: async (limit = 100): Promise<DocumentNumberAudit[]> => {
    const res = await apiClient.get<DocumentNumberAudit[]>(
      `/document-numbering/logs/audit?limit=${limit}`
    );
    return res.data;
  },

  /**
   * Get error logs
   */
  getErrorLogs: async (limit = 100): Promise<DocumentNumberError[]> => {
    const res = await apiClient.get<DocumentNumberError[]>(
      `/document-numbering/logs/errors?limit=${limit}`
    );
    return res.data;
  },

  /**
   * Get metrics (audit + errors combined)
   */
  getMetrics: async (): Promise<{ audit: DocumentNumberAudit[]; errors: DocumentNumberError[] }> => {
    const res = await apiClient.get<{ audit: DocumentNumberAudit[]; errors: DocumentNumberError[] }>(
      '/admin/document-numbering/metrics'
    );
    return res.data;
  },

  // ----------------------------------------------------------
  // Admin Tools
  // ----------------------------------------------------------

  /**
   * Manually override/set a counter value
   */
  manualOverride: async (dto: ManualOverrideDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      '/admin/document-numbering/manual-override',
      dto
    );
    return res.data;
  },

  /**
   * Void a document number and generate replacement
   */
  voidAndReplace: async (dto: VoidAndReplaceDto): Promise<{ newNumber: string; auditId: number }> => {
    const res = await apiClient.post<{ newNumber: string; auditId: number }>(
      '/admin/document-numbering/void-and-replace',
      dto
    );
    return res.data;
  },

  /**
   * Cancel/skip a document number
   */
  cancelNumber: async (dto: CancelNumberDto): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean }>(
      '/admin/document-numbering/cancel',
      dto
    );
    return res.data;
  },

  /**
   * Bulk import counter values
   */
  bulkImport: async (items: BulkImportItem[]): Promise<{ imported: number; errors: string[] }> => {
    const res = await apiClient.post<{ imported: number; errors: string[] }>(
      '/admin/document-numbering/bulk-import',
      items
    );
    return res.data;
  },

  /**
   * Update counter sequence value (Admin only)
   */
  updateCounter: async (counterId: number, sequence: number): Promise<void> => {
    await apiClient.patch(`/document-numbering/counters/${counterId}`, { sequence });
  },

  // ----------------------------------------------------------
  // Placeholder Methods (Backend not yet implemented)
  // ----------------------------------------------------------

  /**
   * Get all counter sequences
   */
  getSequences: async (projectId?: number): Promise<NumberSequence[]> => {
    const url = projectId
      ? `/document-numbering/sequences?projectId=${projectId}`
      : '/document-numbering/sequences';
    const res = await apiClient.get<NumberSequence[]>(url);
    return res.data;
  },

  /**
   * Preview what a document number would look like (without generating)
   */
  previewNumber: async (ctx: {
    projectId: number;
    originatorOrganizationId: number;
    correspondenceTypeId: number;
    disciplineId?: number;
    subTypeId?: number;
    rfaTypeId?: number;
    recipientOrganizationId?: number;
  }): Promise<{ previewNumber: string; nextSequence: number }> => {
    const res = await apiClient.post<{ data: { previewNumber: string; nextSequence: number } }>(
      '/document-numbering/preview',
      ctx
    );
    // Backend wraps response in { data: { ... }, message: "Success" }
    return res.data.data || res.data;
  },

  /**
   * Generate test number - Uses preview endpoint
   * @deprecated Use previewNumber instead
   */
  generateTestNumber: async (
    _templateId: number,
    context: { organizationId: string; disciplineId: string }
  ): Promise<{ number: string }> => {
    // Fallback mock for legacy UI - requires proper context for real use
    const mockNumber = `TEST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    console.log('Using mock generateTestNumber. Context:', context);
    return { number: mockNumber };
  },
};

// ============================================================
// Types for Sequences
// ============================================================

/**
 * Number Sequence / Counter record
 */
export interface NumberSequence {
  projectId: number;
  originatorId: number;
  recipientOrganizationId: number;
  typeId: number;
  disciplineId: number;
  year: number;
  lastNumber: number;
}

/**
 * Preview Number Context
 */
export interface PreviewNumberContext {
  projectId: number;
  originatorId: number;
  typeId: number;
  disciplineId?: number;
  subTypeId?: number;
  rfaTypeId?: number;
  recipientOrganizationId?: number;
}
