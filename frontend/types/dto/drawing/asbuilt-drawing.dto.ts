// File: src/types/dto/drawing/asbuilt-drawing.dto.ts

// --- Create New As Built Drawing ---
export interface CreateAsBuiltDrawingDto {
  projectId: number;
  drawingNumber: string;

  // First Revision Data
  revisionLabel?: string;
  title?: string;
  legacyDrawingNumber?: string;
  revisionDate?: string; // ISO Date String
  description?: string;

  shopDrawingRevisionIds?: number[]; // Reference to Shop Drawing Revisions
  attachmentIds?: number[];
}

// --- Create New Revision ---
export interface CreateAsBuiltDrawingRevisionDto {
  revisionLabel: string;
  title: string;
  legacyDrawingNumber?: string;
  revisionDate?: string;
  description?: string;

  shopDrawingRevisionIds?: number[];
  attachmentIds?: number[];
}

// --- Search ---
export interface SearchAsBuiltDrawingDto {
  projectId: number;
  search?: string;

  page?: number;     // Default: 1
  pageSize?: number; // Default: 20
}
