// File: src/types/dto/transmittal/transmittal.dto.ts

export enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL',
  FOR_INFORMATION = 'FOR_INFORMATION',
  FOR_REVIEW = 'FOR_REVIEW',
  OTHER = 'OTHER',
}

// --- Create ---
export interface CreateTransmittalDto {
  projectId?: number | string; // ADR-019: Accept UUID
  recipientOrganizationId?: number | string; // ADR-019: Accept UUID
  subject: string;
  purpose?: string;
  remarks?: string;
  correspondenceId: number | string; // ADR-019: Accept UUID
  items: CreateTransmittalItemDto[];
}

export interface CreateTransmittalItemDto {
  itemType: string;
  itemId: number;
  description?: string;
}

// --- Update (Partial) ---
export type UpdateTransmittalDto = Partial<CreateTransmittalDto>;

// --- Search ---
export interface SearchTransmittalDto {
  /** บังคับระบุ Project */
  projectId: number | string; // ADR-019: Accept UUID

  purpose?: TransmittalPurpose;

  /** ค้นหาจากเลขที่เอกสาร หรือ remarks */
  search?: string;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  pageSize?: number;
}
