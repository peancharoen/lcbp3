export interface Role {
  publicId: string; // ADR-019: public identifier
  roleId?: number; // Internal INT (excluded from API)
  roleName: string;
  description: string;
}

export interface User {
  publicId: string; // ADR-019: public identifier
  userId?: number; // Internal INT (excluded from API)
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
  publicId: string; // ADR-019: public identifier
  orgId?: number; // Internal INT (excluded from API)
  orgCode: string;
  orgName: string;
  orgNameTh?: string;
  description?: string;
}

export interface AuditLog {
  publicId: string; // ADR-019: public identifier
  auditLogId?: number; // Internal INT (excluded from API)
  userName: string;
  action: string;
  entityType: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}
