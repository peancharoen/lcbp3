export interface Role {
  roleId: number;
  roleName: string;
  description: string;
}

export interface UserOrganization {
  organization_id: number;
  org_code: string;
  org_name: string;
  org_name_th?: string;
}

export interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  line_id?: string;
  primary_organization_id?: number;
  organization?: UserOrganization;
  roles?: Role[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  is_active: boolean;
  line_id?: string;
  primary_organization_id?: number;
  role_ids: number[];
}

export interface UpdateUserDto extends Partial<CreateUserDto> {}

export interface SearchUserDto {
  page?: number;
  limit?: number;
  search?: string;
  role_id?: number;
}
