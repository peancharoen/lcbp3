export interface RFAItem {
  id?: number;
  item_no: string;
  description: string;
  quantity: number;
  unit: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export interface RFA {
  rfa_id: number;
  rfa_number: string;
  subject: string;
  description?: string;
  contract_id: number;
  discipline_id: number;
  status: "DRAFT" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  created_at: string;
  updated_at: string;
  items: RFAItem[];
  // Mock fields for display
  contract_name?: string;
  discipline_name?: string;
}

export interface CreateRFADto {
  subject: string;
  description?: string;
  contract_id: number;
  discipline_id: number;
  items: RFAItem[];
}
