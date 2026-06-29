// File: types/dto/migration/migration-review.dto.ts
// Change Log:
// - 2026-05-22: Initial creation for US2 - Staging Migration Review Commit Types
// - 2026-05-22: Update to support hybrid ID (number | string) for projects and organizations per ADR-019

export interface CommitMigrationReviewDto {
  publicId: string;
  subject?: string;
  category?: string;
  projectId?: number | string;
  senderId?: number | string;
  receiverId?: number | string;
  issuedDate?: string;
  receivedDate?: string;
  tags?: string[];
  body?: string;
}
