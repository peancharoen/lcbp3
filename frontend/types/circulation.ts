// File: types/circulation.ts
// TypeScript interfaces for Circulation module - aligned with backend entities

/**
 * Circulation routing status enum
 */
export type CirculationRoutingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

/**
 * Circulation routing (assignee task within a circulation)
 */
export interface CirculationRouting {
  id: number;
  circulationId: number;
  stepNumber: number;
  organizationId: number;
  assignedTo?: number;
  status: CirculationRoutingStatus;
  comments?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined relations from API
  assignee?: {
    userId: number;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  organization?: {
    id: number;
    organizationCode: string;
    organizationName: string;
  };
}

/**
 * Main Circulation entity
 */
export interface Circulation {
  uuid: string;
  id?: number; // Excluded from API responses (ADR-019)
  correspondenceId?: number;
  organizationId: number;
  circulationNo: string;
  subject: string;
  statusCode: string;
  createdByUserId: number;
  submittedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined relations from API
  routings?: CirculationRouting[];
  correspondence?: {
    uuid: string;
    id?: number;
    correspondenceNumber: string;
  };
  organization?: {
    uuid: string;
    id?: number;
    organizationCode: string;
    organizationName: string;
  };
  creator?: {
    uuid: string;
    userId?: number;
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Paginated response for circulation list
 */
export interface CirculationListResponse {
  data: Circulation[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * DTO for creating a circulation
 */
export interface CreateCirculationDto {
  correspondenceId: number | string;
  projectId?: number | string;
  subject: string;
  assigneeIds: (number | string)[];
  remarks?: string;
}

/**
 * DTO for search/filter params
 */
export interface SearchCirculationDto {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

/**
 * DTO for updating routing status
 */
export interface UpdateCirculationRoutingDto {
  status: CirculationRoutingStatus;
  comments?: string;
}
