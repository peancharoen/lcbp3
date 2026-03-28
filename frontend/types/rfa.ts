export interface RFAItem {
  id?: number;
  itemType: 'SHOP' | 'AS_BUILT';
  shopDrawingRevision?: {
    publicId?: string;
    revisionLabel?: string;
    revisionNumber?: number;
    title?: string;
    legacyDrawingNumber?: string;
    attachments?: { id?: number; url?: string; name?: string }[];
    shopDrawing?: {
      publicId?: string;
      drawingNumber?: string;
    };
  };
  asBuiltDrawingRevision?: {
    publicId?: string;
    revisionLabel?: string;
    revisionNumber?: number;
    title?: string;
    legacyDrawingNumber?: string;
    attachments?: { id?: number; url?: string; name?: string }[];
    asBuiltDrawing?: {
      publicId?: string;
      drawingNumber?: string;
    };
  };
}

export interface RFA {
  publicId: string; // ADR-019: public identifier (from correspondence.publicId)
  rfaTypeId: number;
  createdBy: number;
  disciplineId?: number;
  revisions: {
    id: number;
    revisionNumber: number;
    revisionLabel?: string;
    subject: string;
    description?: string;
    body?: string;
    remarks?: string;
    dueDate?: string;
    isCurrent: boolean;
    createdAt?: string;
    statusCode?: { statusCode: string; statusName: string };
    approveCode?: { approveCode: string; approveCodeName: string };
    approvedDate?: string;
    items?: RFAItem[];
  }[];
  discipline?: {
    id: number;
    name: string;
    code: string;
  };
  // Shared Correspondence Relation
  correspondence?: {
    publicId: string; // ADR-019: public identifier
    correspondenceNumber: string;
    projectId: number;
    originatorId?: number;
    createdAt?: string;
    project?: {
      publicId: string;
      projectName: string;
      projectCode: string;
    };
    discipline?: {
      disciplineCode: string;
      codeNameEn?: string;
      codeNameTh?: string;
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
  shopDrawingRevisionIds?: Array<number | string>;
  asBuiltDrawingRevisionIds?: Array<number | string>;
}
