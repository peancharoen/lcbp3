export interface RFAItem {
  id?: number;
  itemType: 'SHOP' | 'AS_BUILT';
  shopDrawingRevision?: {
    uuid?: string;
    revisionLabel?: string;
    revisionNumber?: number;
    title?: string;
    legacyDrawingNumber?: string;
    attachments?: { id?: number; url?: string; name?: string }[];
    shopDrawing?: {
      uuid?: string;
      drawingNumber?: string;
    };
  };
  asBuiltDrawingRevision?: {
    uuid?: string;
    revisionLabel?: string;
    revisionNumber?: number;
    title?: string;
    legacyDrawingNumber?: string;
    attachments?: { id?: number; url?: string; name?: string }[];
    asBuiltDrawing?: {
      uuid?: string;
      drawingNumber?: string;
    };
  };
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
    description?: string;
    isCurrent: boolean;
    createdAt?: string;
    statusCode?: { statusCode: string; statusName: string };
    items?: RFAItem[];
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
  shopDrawingRevisionIds?: Array<number | string>;
  asBuiltDrawingRevisionIds?: Array<number | string>;
}
