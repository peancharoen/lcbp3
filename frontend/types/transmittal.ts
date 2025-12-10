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
  id: number;
  correspondenceId: number;
  transmittalNo: string;
  subject: string;
  purpose?: TransmittalPurpose;
  remarks?: string;
  createdAt: string;
  // Joined relations from API
  items?: TransmittalItem[];
  correspondence?: {
    id: number;
    correspondence_number: string;
    project_id: number;
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
  projectId?: number;
  recipientOrganizationId?: number;
  correspondenceId: number;
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
  projectId?: number;
  search?: string;
}
