export interface Organization {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  organizationCode: string;
  organizationName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
