

export interface AuditErrorRecord {
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface NumberingAuditLog {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  documentNumber: string;
  operation: string;
  status: string;
  createdAt: string;
  createdBy?: string;
}

export interface NumberingMetrics {
  audit: NumberingAuditLog[];
  errors: AuditErrorRecord[];
}

export interface ManualOverrideDto {
  projectId: number | string; // ADR-019: Accept UUID
  originatorOrganizationId: number | string; // ADR-019: Accept UUID
  recipientOrganizationId: number | string; // ADR-019: Accept UUID
  correspondenceTypeId: number | string; // ADR-019: Accept UUID
  subTypeId?: number | string; // ADR-019: Accept UUID
  rfaTypeId?: number | string; // ADR-019: Accept UUID
  disciplineId?: number | string; // ADR-019: Accept UUID
  resetScope: string;
  newLastNumber: number;
  reason: string;
}

export interface VoidReplaceDto {
  documentNumber: string;
  reason: string;
  replace: boolean;
  projectId: number | string; // ADR-019: Accept UUID
}

export interface CancelNumberDto {
  documentNumber: string;
  reason: string;
  projectId?: number | string; // ADR-019: Accept UUID
}

export interface AuditQueryParams {
  projectId?: number | string; // ADR-019: Accept UUID
  limit?: number;
}
