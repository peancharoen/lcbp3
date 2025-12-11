export interface RFAItem {
  id?: number;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export interface RFA {
  id: number;
  rfaTypeId: number;
  createdBy: number;
  disciplineId?: number;
  revisions: {
    items?: {
       shopDrawingRevision?: {
         attachments?: { id: number; url: string; name: string }[]
       }
    }[];
  }[];
  discipline?: {
    id: number;
    name: string;
    code: string;
  };
  // Deprecated/Mapped fields (keep optional if frontend uses them elsewhere)
  rfaId?: number;
  rfaNumber?: string;
  subject?: string;
  status?: string;
  createdAt?: string;
  contractName?: string;
  disciplineName?: string;
}

export interface CreateRFADto {
  projectId?: number;
  rfaTypeId: number;
  title: string;
  description?: string;
  contractId: number;
  disciplineId: number;
  toOrganizationId: number;
  dueDate?: string;
  shopDrawingRevisionIds?: number[];
  items: RFAItem[];
}
