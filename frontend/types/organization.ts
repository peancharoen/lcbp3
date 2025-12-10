export interface Organization {
  id: number;
  organizationCode: string;
  organizationName: string;
  roleId?: number; // NEW - organization role (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD_PARTY)
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
