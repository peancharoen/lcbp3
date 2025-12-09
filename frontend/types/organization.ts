export interface Organization {
  id: number;
  organizationCode: string;
  organizationName: string;
  organizationNameTh?: string; // Optional if not present in backend entity
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // Keep legacy types optional for backward compatibility if needed, or remove them
  organization_id?: number;
  org_code?: string;
  org_name?: string;
  org_name_th?: string;
}
