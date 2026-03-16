export interface Organization {
  uuid: string;
  id?: number; // Excluded from API responses (ADR-019)
  organizationCode: string;
  organizationName: string;
  roleId?: number; // NEW - organization role (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD_PARTY)
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
