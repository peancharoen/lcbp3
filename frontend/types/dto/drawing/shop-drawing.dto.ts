// File: src/types/dto/drawing/shop-drawing.dto.ts

// --- Create New Shop Drawing ---
export interface CreateShopDrawingDto {
  projectId: number | string; // ADR-019: Accept UUID
  drawingNumber: string;
  title: string;
  mainCategoryId: number | string; // ADR-019: Accept UUID
  subCategoryId: number | string; // ADR-019: Accept UUID

  // First Revision Data (Optional)
  revisionLabel?: string;
  revisionDate?: string; // ISO Date String
  description?: string;
  legacyDrawingNumber?: string; // Legacy number for the first revision
  contractDrawingIds?: (number | string)[]; // ADR-019: Accept UUID - อ้างอิงแบบสัญญา
  attachmentIds?: (number | string)[]; // ADR-019: Accept UUID
}

// --- Create New Revision ---
export interface CreateShopDrawingRevisionDto {
  revisionLabel: string;
  title: string; // Title per revision
  legacyDrawingNumber?: string;
  revisionDate?: string;
  description?: string;
  contractDrawingIds?: (number | string)[]; // ADR-019: Accept UUID
  attachmentIds?: (number | string)[]; // ADR-019: Accept UUID
}

// --- Search ---
export interface SearchShopDrawingDto {
  projectUuid: string;
  mainCategoryId?: number | string; // ADR-019: Accept UUID
  subCategoryId?: number | string; // ADR-019: Accept UUID
  search?: string;

  page?: number; // Default: 1
  limit?: number; // Default: 20
}
