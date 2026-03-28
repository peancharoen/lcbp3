// DTOs for Organization management
// Aligned with backend CreateOrganizationDto, UpdateOrganizationDto, SearchOrganizationDto

export interface CreateOrganizationDto {
  organizationCode: string;
  organizationName: string;
  roleId?: number | string; // ADR-019: Accept UUID
  isActive?: boolean;
}

export interface UpdateOrganizationDto {
  organizationCode?: string;
  organizationName?: string;
  roleId?: number | string; // ADR-019: Accept UUID
  isActive?: boolean;
}

export interface SearchOrganizationDto {
  search?: string;
  projectId?: number | string; // ADR-019: Accept UUID
  page?: number;
  limit?: number;
  isActive?: boolean;
}
