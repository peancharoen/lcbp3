export interface Role {
  roleId: number;
  roleName: string;
  description: string;
}

export interface UserOrganization {
  organizationId: number;
  orgCode: string;
  orgName: string;
  orgNameTh?: string;
}

export interface User {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  userId?: number; // Excluded from API responses (ADR-019)
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lineId?: string;
  primaryOrganizationId?: number | string; // ADR-019: May be INT or UUID
  organization?: UserOrganization;
  roles?: Role[];

  // Security fields (from backend v1.5.1)
  failedAttempts: number;
  lockedUntil?: string;
  lastLoginAt?: string;

  // Audit columns
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  isActive: boolean;
  lineId?: string;
  primaryOrganizationId?: number | string; // ADR-019: Accept UUID
  roleIds: number[];
}

export type UpdateUserDto = Partial<CreateUserDto>;

export interface SearchUserDto {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: number;
  primaryOrganizationId?: number | string; // ADR-019: Accept UUID
}
