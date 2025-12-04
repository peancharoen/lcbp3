export interface SearchResult {
  id: number;
  type: "correspondence" | "rfa" | "drawing";
  title: string;
  description?: string;
  status: string;
  documentNumber: string;
  createdAt: string;
  highlight?: string;
}

export interface SearchFilters {
  query?: string;
  types?: string[];
  statuses?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}
