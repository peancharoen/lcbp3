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

export interface Correspondence {
  correspondenceId: number;
  documentNumber: string;
  subject: string;
  description?: string;
  status: "DRAFT" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  importance: "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  updatedAt: string;
  fromOrganizationId: number;
  toOrganizationId: number;
  fromOrganization?: Organization;
  toOrganization?: Organization;
  documentTypeId: number;
  attachments?: Attachment[];
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
