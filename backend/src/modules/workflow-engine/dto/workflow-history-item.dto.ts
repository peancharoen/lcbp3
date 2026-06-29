// ADR-021: Response DTOs สำหรับ GET /instances/:id/history
export class AttachmentSummaryDto {
  publicId!: string;
  originalFilename!: string;
  mimeType?: string;
  fileSize?: number;
}

export class WorkflowHistoryItemDto {
  id!: string;
  fromState!: string;
  toState!: string;
  action!: string;
  actionByUserId?: number;
  // ADR-019: UUID ของ User ผู้ดำเนินการ — expose แทน INT PK ในทุก API Response
  actorUuid?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  attachments!: AttachmentSummaryDto[];
  createdAt!: string;
}
