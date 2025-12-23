// Entity Interfaces
export interface DrawingRevision {
  revisionId: number;
  revisionNumber: string;
  title?: string; // Added
  legacyDrawingNumber?: string; // Added
  revisionDate: string;
  revisionDescription?: string;
  revisedByName: string;
  fileUrl: string;
  isCurrent: boolean;
}

export interface ContractDrawing {
  id: number;
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
  id: number;
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
  id: number;
  drawingNumber: string;
  projectId: number;
  currentRevision?: DrawingRevision;
  createdAt: string;
  updatedAt: string;
}

// Unified Type for List
export interface Drawing {
  drawingId: number;
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
  drawingType: "CONTRACT" | "SHOP";
  drawingNumber: string;
  title: string;
  disciplineId: number;
  sheetNumber: string;
  scale?: string;
  file: File;
}
