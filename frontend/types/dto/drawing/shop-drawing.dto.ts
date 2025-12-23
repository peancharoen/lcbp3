// File: src/types/dto/drawing/shop-drawing.dto.ts

// --- Create New Shop Drawing ---
export interface CreateShopDrawingDto {
  projectId: number;
  drawingNumber: string;
  title: string;
  mainCategoryId: number;
  subCategoryId: number;

  // First Revision Data (Optional)
  revisionLabel?: string;
  revisionDate?: string; // ISO Date String
  description?: string;
  legacyDrawingNumber?: string; // Legacy number for the first revision
  contractDrawingIds?: number[]; // อ้างอิงแบบสัญญา
  attachmentIds?: number[];
}

// --- Create New Revision ---
export interface CreateShopDrawingRevisionDto {
  revisionLabel: string;
  title: string; // Title per revision
  legacyDrawingNumber?: string;
  revisionDate?: string;
  description?: string;
  contractDrawingIds?: number[];
  attachmentIds?: number[];
}

// --- Search ---
export interface SearchShopDrawingDto {
  projectId: number;
  mainCategoryId?: number;
  subCategoryId?: number;
  search?: string;

  page?: number;     // Default: 1
  pageSize?: number; // Default: 20
}
