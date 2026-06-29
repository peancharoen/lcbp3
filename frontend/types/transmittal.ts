// File: types/transmittal.ts
// TypeScript interfaces for Transmittal module - aligned with backend entities

/**
 * Transmittal purpose enum
 */
export type TransmittalPurpose = 'FOR_APPROVAL' | 'FOR_INFORMATION' | 'FOR_REVIEW' | 'OTHER';

/**
 * Item type in a transmittal
 */
export type TransmittalItemType = 'DRAWING' | 'RFA' | 'CORRESPONDENCE';

/**
 * Transmittal item - document included in a transmittal
 */
export interface TransmittalItem {
  transmittalId: number;
  itemType: TransmittalItemType;
  itemId: number;
  description?: string;
  // Joined data for display
  documentNumber?: string;
  documentTitle?: string;
}

/**
 * Main Transmittal entity
 */
export interface Transmittal {
  publicId: string; // ADR-019: from correspondence.publicId
  id?: number; // Excluded from API responses (ADR-019)
  correspondenceId?: number | string;
  transmittalNo: string;
  subject: string;
  purpose?: TransmittalPurpose;
  remarks?: string;
  createdAt: string;
  // ADR-021 / v1.8.7: Workflow context fields
  workflowInstanceId?: string; // UUID ของ WorkflowInstance (null = Draft ยังไม่ submit)
  workflowState?: string; // สถานะปัจจุบันใน Workflow เช่น IN_REVIEW, APPROVED
  availableActions?: string[]; // Actions ที่ทำได้ ณ ขณะนี้ เช่น ['APPROVE', 'REJECT']
  // Joined relations from API
  items?: TransmittalItem[];
  correspondence?: {
    publicId: string;
    id?: number;
    correspondenceNumber: string;
    projectId: number;
    createdAt?: string;
    revisions?: { title?: string; isCurrent?: boolean }[];
  };
}

/**
 * Paginated response for transmittal list
 */
export interface TransmittalListResponse {
  data: Transmittal[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Item DTO for creating transmittal
 */
export interface CreateTransmittalItemDto {
  itemType: TransmittalItemType;
  itemId: number;
  description?: string;
}

/**
 * DTO for creating a transmittal
 */
export interface CreateTransmittalDto {
  projectId?: number | string; // ADR-019: Accept UUID
  recipientOrganizationId?: number | string; // ADR-019: Accept UUID
  correspondenceId: number | string; // ADR-019: Accept UUID
  subject: string;
  purpose?: TransmittalPurpose;
  remarks?: string;
  items: CreateTransmittalItemDto[];
}

/**
 * DTO for search/filter params
 */
export interface SearchTransmittalDto {
  page?: number;
  limit?: number;
  projectId?: number | string; // ADR-019: Accept UUID
  purpose?: TransmittalPurpose; // v1.8.7: B3 purpose filter
  search?: string;
}
