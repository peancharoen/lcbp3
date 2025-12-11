export interface Organization {
  id: number;
  orgName: string;
  orgCode: string;
}

export interface Attachment {
  id: number;
  name: string;
  url: string;
  size?: number;
  type?: string;
  createdAt?: string;
}

// Used in List View mainly
export interface CorrespondenceRevision {
  id: number;
  revisionNumber: number;
  revisionLabel?: string; // e.g. "A", "00"
  title: string;
  description?: string;
  isCurrent: boolean;
  status?: {
    id: number;
    statusCode: string;
    statusName: string;
  };
  details?: any;
  attachments?: Attachment[];
  createdAt: string;

  // Nested Relation from Backend Refactor
  correspondence: {
    id: number;
    correspondenceNumber: string;
    projectId: number;
    originatorId?: number;
    isInternal: boolean;
    originator?: Organization;
    project?: { id: number; projectName: string; projectCode: string };
    type?: { id: number; typeName: string; typeCode: string };
  }
}

// Keep explicit Correspondence for Detail View if needed, or merge concepts
export interface Correspondence {
  id: number;
  correspondenceNumber: string;
  projectId: number;
  originatorId?: number;
  correspondenceTypeId: number;
  isInternal: boolean;
  createdAt: string;

  // Relations
  originator?: Organization;
  project?: { id: number; projectName: string; projectCode: string };
  type?: { id: number; typeName: string; typeCode: string };
  revisions?: CorrespondenceRevision[]; // Nested revisions
}

export interface CreateCorrespondenceDto {
  subject: string;
  description?: string;
  documentTypeId: number;
  fromOrganizationId: number;
  toOrganizationId: number;
  importance: "NORMAL" | "HIGH" | "URGENT";
  attachments?: File[];
}
