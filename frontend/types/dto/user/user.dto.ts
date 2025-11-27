// File: src/types/dto/user/user.dto.ts

// --- Create User ---
export interface CreateUserDto {
  username: string;
  password: string; // จำเป็นสำหรับการสร้าง
  email: string;
  firstName?: string;
  lastName?: string;
  lineId?: string;
  primaryOrganizationId?: number;
  isActive?: boolean;
}

// --- Update User ---
export interface UpdateUserDto extends Partial<CreateUserDto> {}

// --- Assign Role ---
export interface AssignRoleDto {
  userId: number;
  roleId: number;
  
  // Scope (Optional)
  organizationId?: number;
  projectId?: number;
  contractId?: number;
}

// --- Update Preferences ---
export interface UpdatePreferenceDto {
  notifyEmail?: boolean;
  notifyLine?: boolean;
  digestMode?: boolean;
  uiTheme?: 'light' | 'dark' | 'system';
}