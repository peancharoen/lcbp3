// File: src/types/dto/drawing/asbuilt-drawing.dto.ts

// --- Create New As Built Drawing ---
export interface CreateAsBuiltDrawingDto {
  projectId: number | string; // ADR-019: Accept UUID
  drawingNumber: string;
  mainCategoryId: number | string; // ADR-019: Accept UUID
  subCategoryId: number | string; // ADR-019: Accept UUID

  // First Revision Data
  revisionLabel?: string;
  title?: string;
  legacyDrawingNumber?: string;
  revisionDate?: string; // ISO Date String
  description?: string;

  shopDrawingRevisionIds?: (number | string)[]; // ADR-019: Accept UUID - Reference to Shop Drawing Revisions
  attachmentIds?: (number | string)[]; // ADR-019: Accept UUID
}

// --- Create New Revision ---
export interface CreateAsBuiltDrawingRevisionDto {
  revisionLabel: string;
  title: string;
  legacyDrawingNumber?: string;
  revisionDate?: string;
  description?: string;

  shopDrawingRevisionIds?: (number | string)[]; // ADR-019: Accept UUID
  attachmentIds?: (number | string)[]; // ADR-019: Accept UUID
}

// --- Search ---
export interface SearchAsBuiltDrawingDto {
  projectUuid: string;
  search?: string;

  page?: number; // Default: 1
  limit?: number; // Default: 20
}
