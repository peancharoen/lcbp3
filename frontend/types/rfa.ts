export interface RFAItem {
  id?: number;
  itemNo: string;
  description: string;
  quantity: number;
  unit: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export interface RFA {
  rfaId: number;
  rfaNumber: string;
  subject: string;
  description?: string;
  contractId: number;
  disciplineId: number;
  status: "DRAFT" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  items: RFAItem[];
  // Mock fields for display
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
