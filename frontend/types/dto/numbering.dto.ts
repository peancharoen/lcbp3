

export interface AuditErrorRecord {
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface NumberingAuditLog {
  id: number;
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
  projectId: number;
  originatorOrganizationId: number;
  recipientOrganizationId: number;
  correspondenceTypeId: number;
  subTypeId?: number;
  rfaTypeId?: number;
  disciplineId?: number;
  resetScope: string;
  newLastNumber: number;
  reason: string;
}

export interface VoidReplaceDto {
  documentNumber: string;
  reason: string;
  replace: boolean;
  projectId: number;
}

export interface CancelNumberDto {
  documentNumber: string;
  reason: string;
  projectId?: number;
}

export interface AuditQueryParams {
  projectId?: number;
  limit?: number;
}
