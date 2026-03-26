export interface Organization {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  organizationName: string;
  organizationCode: string;
}

export interface Attachment {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  name: string;
  url: string;
  size?: number;
  type?: string;
  createdAt?: string;
}

// Used in List View mainly
export interface CorrespondenceRevision {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  revisionNumber: number;
  revisionLabel?: string; // e.g. "A", "00"
  subject: string;
  body?: string;
  remarks?: string;
  dueDate?: string;
  documentDate?: string;
  issuedDate?: string;
  receivedDate?: string;
  schemaVersion?: number;
  description?: string;
  isCurrent: boolean;
  status?: {
    id: number;
    statusCode: string;
    statusName: string;
  };
  details?: Record<string, unknown> | null;
  attachments?: Attachment[];
  createdAt: string;

  // Nested Relation from Backend Refactor
  correspondence: {
    publicId: string;
    id?: number; // Excluded from API responses (ADR-019)
    correspondenceNumber: string;
    projectId: number;
    originatorId?: number;
    isInternal: boolean;
    originator?: Organization;
    project?: { publicId: string; id?: number; projectName: string; projectCode: string };
    type?: { id: number; typeName: string; typeCode: string };
  };
}

// Keep explicit Correspondence for Detail View if needed, or merge concepts
export interface Correspondence {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  id?: number; // Excluded from API responses (ADR-019)
  correspondenceNumber: string;
  projectId: number;
  originatorId?: number;
  correspondenceTypeId: number;
  isInternal: boolean;
  createdAt: string;

  // Relations
  originator?: Organization;
  project?: { publicId: string; id?: number; projectName: string; projectCode: string };
  type?: { id: number; typeName: string; typeCode: string };
  revisions?: CorrespondenceRevision[]; // Nested revisions
  recipients?: {
    correspondenceId: number;
    recipientOrganizationId: number;
    recipientType: 'TO' | 'CC';
    recipientOrganization?: Organization;
  }[];
}

export interface CreateCorrespondenceDto {
  projectId: number;
  typeId: number;
  subTypeId?: number;
  disciplineId?: number;
  subject: string;
  body?: string;
  remarks?: string;
  dueDate?: string;
  description?: string;
  details?: Record<string, unknown>;
  isInternal?: boolean;
  originatorId?: number;
  recipients?: { organizationId: number; type: 'TO' | 'CC' }[];
  attachments?: File[];
}
