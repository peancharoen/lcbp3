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

// --- Update Preferences ---
export interface UpdatePreferenceDto {
  notifyEmail?: boolean;
  notifyLine?: boolean;
  digestMode?: boolean;
  uiTheme?: 'light' | 'dark' | 'system';
}
