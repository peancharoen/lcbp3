export interface Role {
  roleId: number;
  roleName: string;
  description: string;
}

export interface User {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Role[];
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  isActive: boolean;
  roles: number[];
}

export interface Organization {
  orgId: number;
  orgCode: string;
  orgName: string;
  orgNameTh?: string;
  description?: string;
}

export interface AuditLog {
  auditLogId: number;
  userName: string;
  action: string;
  entityType: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}
