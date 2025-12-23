export interface NumberingMetrics {
  audit: any[]; // Replace with specific AuditLog type if available
  errors: any[]; // Replace with specific ErrorLog type
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
