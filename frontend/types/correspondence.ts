export interface Organization {
  id: number;
  org_name: string;
  org_code: string;
}

export interface Attachment {
  id: number;
  name: string;
  url: string;
  size?: number;
  type?: string;
  created_at?: string;
}

export interface Correspondence {
  correspondence_id: number;
  document_number: string;
  subject: string;
  description?: string;
  status: "DRAFT" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  importance: "NORMAL" | "HIGH" | "URGENT";
  created_at: string;
  updated_at: string;
  from_organization_id: number;
  to_organization_id: number;
  from_organization?: Organization;
  to_organization?: Organization;
  document_type_id: number;
  attachments?: Attachment[];
}

export interface CreateCorrespondenceDto {
  subject: string;
  description?: string;
  document_type_id: number;
  from_organization_id: number;
  to_organization_id: number;
  importance: "NORMAL" | "HIGH" | "URGENT";
  attachments?: File[];
}
