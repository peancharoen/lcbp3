// File: frontend/types/user.ts
// Change Log:
// - 2026-09-25: Feature 258 (T056) — เพิ่ม telegramStatus/telegramUsername fields
// - 2026-09-30: ปรับ User type ให้ตรง API response จริง — ลบ userId/primaryOrganizationId,
//   แก้ organization shape ตาม entity จริง, เพิ่ม mustChangePassword/security fields

export interface Role {
  publicId?: string; // ADR-019: public identifier
  roleId?: number; // Internal INT — ใช้ผูกกับ user_assignments/roleIds เท่านั้น
  roleName: string;
  scope?: string; // Global | Organization | Project | Contract
  description?: string;
}

/** Organization ที่ embed มากับ user — list ได้ครบ, detail ได้ทั้ง object */
export interface UserOrganization {
  publicId: string; // ADR-019: UUID only
  organizationCode?: string;
  organizationName?: string;
}

export interface User {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  username: string;
  email: string;
  firstName?: string; // nullable ใน DB
  lastName?: string; // nullable ใน DB
  isActive: boolean;
  lineId?: string;
  organization?: UserOrganization; // primary organization (สังกัดหลัก)
  roles?: Role[]; // derive จาก assignments[].role

  // Security fields (from backend v1.5.1)
  mustChangePassword?: boolean; // SEV-014: บังคับเปลี่ยนรหัสผ่าน login ครั้งแรก
  failedAttempts?: number;
  lockedUntil?: string;
  lastLoginAt?: string;

  // Audit columns
  createdAt?: string;
  updatedAt?: string;

  // Feature 258: Telegram binding status (list response only)
  telegramStatus?: 'linked' | 'blocked' | 'none';
  telegramUsername?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  isActive: boolean;
  lineId?: string;
  primaryOrganizationId?: string; // ADR-019: UUID string only
  roleIds?: number[]; // role_id (INT) → user_assignments Global scope
  mustChangePassword?: boolean; // SEV-014: admin สร้าง user ใหม่ควรบังคับเปลี่ยนรหัส
}

export type UpdateUserDto = Partial<CreateUserDto>;

export interface SearchUserDto {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: number;
  primaryOrganizationId?: string; // ADR-019: UUID string only
}
