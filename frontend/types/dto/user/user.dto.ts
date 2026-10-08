// File: src/types/dto/user/user.dto.ts

// --- Create User ---
export interface CreateUserDto {
  username: string;
  password: string; // จำเป็นสำหรับการสร้าง
  email: string;
  firstName?: string;
  lastName?: string;
  lineId?: string;
  primaryOrganizationId?: number | string; // ADR-019: Accept UUID
  departmentId?: number | string; // ADR-019: Accept UUID (department ของ primary org)
  position?: string; // ตำแหน่งใน primary org (free-text)
  isActive?: boolean;
}

// --- Update User ---
export type UpdateUserDto = Partial<CreateUserDto>;

// --- Assign Role ---
export interface AssignRoleDto {
  userId: number | string; // ADR-019: Accept UUID
  roleId: number | string; // ADR-019: Accept UUID

  // Scope (Optional) - ADR-019: Accept UUID
  organizationId?: number | string;
  projectId?: number | string;
  contractId?: number | string;
}

// --- Organization Membership (User Grouping Model) ---

/** Membership ของ user ใน 1 org — API response */
export interface UserOrganizationMembership {
  publicId: string;
  isPrimary: boolean;
  position?: string;
  organization?: {
    publicId: string;
    organizationCode?: string;
    organizationName?: string;
  };
  department?: {
    publicId: string;
    departmentCode?: string;
    departmentName?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AddUserOrganizationDto {
  organizationId: number | string; // ADR-019: Accept UUID
  departmentId?: number | string; // ADR-019: Accept UUID
  position?: string;
  isPrimary?: boolean; // true → sync users.primary_organization_id
}

export type UpdateUserOrganizationDto = Partial<AddUserOrganizationDto>;

// --- Update Preferences ---
export interface UpdatePreferenceDto {
  notifyEmail?: boolean;
  notifyLine?: boolean;
  digestMode?: boolean;
  uiTheme?: 'light' | 'dark' | 'system';
}
