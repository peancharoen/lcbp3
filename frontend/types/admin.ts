export interface Role {
  role_id: number;
  role_name: string;
  description: string;
}

export interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: Role[];
}

export interface CreateUserDto {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  is_active: boolean;
  roles: number[];
}

export interface Organization {
  org_id: number;
  org_code: string;
  org_name: string;
  org_name_th?: string;
  description?: string;
}

export interface AuditLog {
  audit_log_id: number;
  user_name: string;
  action: string;
  entity_type: string;
  description: string;
  ip_address?: string;
  created_at: string;
}
