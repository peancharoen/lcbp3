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

export type UpdateUserGroupDto = Partial<Pick<CreateUserGroupDto, 'name' | 'description'>> & {
  isActive?: boolean;
};

/** Master role ขององค์กร (OWNER/DESIGNER/CONSULTANT/CONTRACTOR/THIRD_PARTY) — ใช้ roleName เป็น identifier */
export interface OrganizationRole {
  roleName: string;
}

/** องค์กรที่ผูกกับ project/contract พร้อม role ใน context นั้น (PR #29 deferred) */
export interface LinkedOrganization {
  organizationId: string; // Organization.publicId
  organizationCode: string;
  organizationName: string;
  roleName: string | null;
}
