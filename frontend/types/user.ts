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
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lineId?: string;
  primaryOrganizationId?: number;
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
  primaryOrganizationId?: number;
  roleIds: number[];
}

export type UpdateUserDto = Partial<CreateUserDto>;

export interface SearchUserDto {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: number;
  primaryOrganizationId?: number;
}
