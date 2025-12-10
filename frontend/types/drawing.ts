export interface DrawingRevision {
  revisionId: number;
  revisionNumber: string;
  revisionDate: string;
  revisionDescription?: string;
  revisedByName: string;
  fileUrl: string;
  isCurrent: boolean;
}

export interface Drawing {
  drawingId: number;
  drawingNumber: string;
  title: string;
  discipline?: string | { disciplineCode: string; disciplineName: string };
  type?: string;
  status?: string;
  revision?: string;
  sheetNumber?: string;
  scale?: string;
  issueDate?: string;
  revisionCount?: number;
  revisions?: DrawingRevision[];
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
