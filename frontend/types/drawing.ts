// Entity Interfaces
export interface DrawingRevision {
  uuid: string;
  revisionId?: number; // Excluded from API responses (ADR-019)
  revisionNumber: string;
  title?: string; // Added
  legacyDrawingNumber?: string; // Added
  revisionDate: string;
  revisionDescription?: string;
  revisedByName: string;
  fileUrl: string;
  isCurrent: boolean | null; // Updated: null = not current (MariaDB UNIQUE pattern)
  createdBy?: number; // Added v1.7.0
  updatedBy?: number; // Added v1.7.0
}

export interface ContractDrawing {
  uuid: string;
  id?: number; // Excluded from API responses (ADR-019)
  contractDrawingNo: string;
  title: string;
  projectId: number;
  mapCatId?: number;
  volumeId?: number;
  volumePage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopDrawing {
  uuid: string;
  id?: number; // Excluded from API responses (ADR-019)
  drawingNumber: string;
  projectId: number;
  mainCategoryId: number;
  subCategoryId: number;
  currentRevision?: DrawingRevision;
  createdAt: string;
  updatedAt: string;
  // title removed
}

export interface AsBuiltDrawing {
  uuid: string;
  id?: number; // Excluded from API responses (ADR-019)
  drawingNumber: string;
  projectId: number;
  mainCategoryId: number;
  subCategoryId: number;
  currentRevision?: DrawingRevision;
  createdAt: string;
  updatedAt: string;
}

// Unified Type for List
export interface Drawing {
  uuid?: string;
  drawingId?: number; // Excluded from API responses (ADR-019)
  drawingNumber: string;
  title: string; // Display title (from current revision for Shop/AsBuilt)
  discipline?: string | { disciplineCode: string; disciplineName: string };
  type?: string;
  status?: string;
  revision?: string;
  sheetNumber?: string;
  legacyDrawingNumber?: string; // Added for display
  scale?: string;
  issueDate?: string;
  revisionCount?: number;
  revisions?: DrawingRevision[];
  volumePage?: number; // Contract only
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDrawingDto {
  drawingType: 'CONTRACT' | 'SHOP';
  drawingNumber: string;
  title: string;
  disciplineId: number;
  sheetNumber: string;
  scale?: string;
  file: File;
}
