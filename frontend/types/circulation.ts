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
    user_id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
  organization?: {
    id: number;
    organization_code: string;
    organization_name: string;
  };
}

/**
 * Main Circulation entity
 */
export interface Circulation {
  id: number;
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
    id: number;
    correspondence_number: string;
  };
  organization?: {
    id: number;
    organization_code: string;
    organization_name: string;
  };
  creator?: {
    user_id: number;
    username: string;
    first_name?: string;
    last_name?: string;
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
  correspondenceId: number;
  projectId?: number;
  subject: string;
  assigneeIds: number[];
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
