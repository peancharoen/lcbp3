export interface RFAItem {
  id?: number;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export interface RFA {
  id: number; // Shared PK with Correspondence
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
    id: number;
    correspondenceNumber: string;
    projectId: number;
    originatorId?: number;
    createdAt?: string;
    project?: {
      projectName: string;
      projectCode: string;
    };
  };

  // Deprecated/Mapped fields
  correspondenceNumber?: string; // Convenience accessor
}

export interface CreateRFADto {
  projectId: number;
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
}
