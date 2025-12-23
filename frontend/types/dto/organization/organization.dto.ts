// DTOs for Organization management
// Aligned with backend CreateOrganizationDto, UpdateOrganizationDto, SearchOrganizationDto

export interface CreateOrganizationDto {
  organizationCode: string;
  organizationName: string;
  roleId?: number;
  isActive?: boolean;
}

export interface UpdateOrganizationDto {
  organizationCode?: string;
  organizationName?: string;
  roleId?: number;
  isActive?: boolean;
}

export interface SearchOrganizationDto {
  search?: string;
  projectId?: number;
  page?: number;
  limit?: number;
  isActive?: boolean;
}
