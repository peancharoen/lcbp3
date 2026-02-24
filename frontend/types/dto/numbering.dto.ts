import type { AuditLog } from '@/lib/services/audit-log.service';

export interface AuditErrorRecord {
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface NumberingMetrics {
  audit: AuditLog[];
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
