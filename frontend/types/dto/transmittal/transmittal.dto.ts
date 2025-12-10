// File: src/types/dto/transmittal/transmittal.dto.ts

export enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL',
  FOR_INFORMATION = 'FOR_INFORMATION',
  FOR_REVIEW = 'FOR_REVIEW',
  OTHER = 'OTHER',
}

// --- Create ---
export interface CreateTransmittalDto {
  projectId?: number;
  recipientOrganizationId?: number;
  subject: string;
  purpose?: string;
  remarks?: string;
  correspondenceId: number; // For now linked correspondence
  items: CreateTransmittalItemDto[];
}

export interface CreateTransmittalItemDto {
  itemType: string;
  itemId: number;
  description?: string;
}

// --- Update (Partial) ---
export interface UpdateTransmittalDto extends Partial<CreateTransmittalDto> {}

// --- Search ---
export interface SearchTransmittalDto {
  /** บังคับระบุ Project */
  projectId: number;

  purpose?: TransmittalPurpose;

  /** ค้นหาจากเลขที่เอกสาร หรือ remarks */
  search?: string;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  pageSize?: number;
}
