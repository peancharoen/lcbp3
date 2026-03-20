export interface RFAItem {
  id?: number;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export interface RFA {
  uuid: string; // ADR-019: from correspondence.uuid
  id?: number; // Excluded from API responses (ADR-019)
  rfaTypeId: number;
  createdBy: number;
  disciplineId?: number;
  revisions: {
    id: number;
    revisionNumber: number;
    subject: string;
    isCurrent: boolean;
    createdAt?: string;
    statusCode?: { statusCode: string; statusName: string };
    items?: {
       shopDrawingRevision?: {
         id: number;
         revisionLabel: string;
         shopDrawing?: { drawingType?: { hasNumber: boolean } }; // Mock structure
         attachments?: { id: number; url: string; name: string }[]
       }
    }[];
  }[];
  discipline?: {
    id: number;
    name: string;
    code: string;
  };
  // Shared Correspondence Relation
  correspondence?: {
    uuid: string;
    id?: number; // Excluded from API responses (ADR-019)
    correspondenceNumber: string;
    projectId: number;
    originatorId?: number;
    createdAt?: string;
    project?: {
      uuid: string;
      projectName: string;
      projectCode: string;
    };
  };

  // Deprecated/Mapped fields
  correspondenceNumber?: string; // Convenience accessor
}

export interface CreateRFADto {
  projectId: number | string; // ADR-019: Accept UUID
  contractId?: string; // ADR-019: Contract UUID
  toOrganizationId?: number | string; // ADR-019: Recipient org UUID
  rfaTypeId: number;
  disciplineId?: number;
  subject: string;
  body?: string; // [New]
  remarks?: string; // [New]
  dueDate?: string; // [New]
  description?: string;
  documentDate?: string;
  details?: Record<string, unknown>;
  shopDrawingRevisionIds?: number[];
  items?: RFAItem[];
}
