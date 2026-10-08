export interface Organization {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  organizationCode: string;
  organizationName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** แผนกภายในองค์กร (org-scoped, flat) — User Grouping Model */
export interface Department {
  publicId: string;
  organizationId?: number;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDepartmentDto {
  departmentCode: string;
  departmentName: string;
}

export type UpdateDepartmentDto = Partial<CreateDepartmentDto> & {
  isActive?: boolean;
};

/** Functional group ของ user ภายใน org (เช่น "ทีม QC") — ใช้กับ circulation claim / reminder recipients */
export interface UserGroup {
  publicId: string;
  organizationId?: number;
  name: string;
  description?: string;
  isActive: boolean;
  members?: UserGroupMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserGroupMember {
  userId?: number;
  user?: {
    publicId: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt?: string;
}

export interface CreateUserGroupDto {
  organizationId: number | string; // ADR-019: Accept UUID
  name: string;
  description?: string;
  memberIds?: string[]; // user publicIds
}

export type UpdateUserGroupDto = Partial<
  Pick<CreateUserGroupDto, 'name' | 'description'>
> & {
  isActive?: boolean;
};
