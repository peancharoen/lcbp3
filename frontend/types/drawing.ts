export interface DrawingRevision {
  revision_id: number;
  revision_number: string;
  revision_date: string;
  revision_description?: string;
  revised_by_name: string;
  file_url: string;
  is_current: boolean;
}

export interface Drawing {
  drawing_id: number;
  drawing_number: string;
  title: string;
  type: "CONTRACT" | "SHOP";
  discipline_id: number;
  discipline?: { id: number; discipline_code: string; discipline_name: string };
  sheet_number: string;
  scale?: string;
  current_revision: string;
  issue_date: string;
  revision_count: number;
  revisions?: DrawingRevision[];
}

export interface CreateDrawingDto {
  drawing_type: "CONTRACT" | "SHOP";
  drawing_number: string;
  title: string;
  discipline_id: number;
  sheet_number: string;
  scale?: string;
  file: File;
}
