import { SearchResult, SearchFilters } from "@/types/search";

// Mock Data
const mockResults: SearchResult[] = [
  {
    id: 1,
    type: "correspondence",
    title: "Submission of Monthly Report - Jan 2025",
    description: "Please find attached the monthly progress report.",
    status: "PENDING",
    documentNumber: "LCBP3-COR-001",
    createdAt: new Date().toISOString(),
    highlight: "Submission of <b>Monthly Report</b> - Jan 2025",
  },
  {
    id: 1,
    type: "rfa",
    title: "Approval for Concrete Mix Design",
    description: "Requesting approval for the proposed concrete mix design.",
    status: "PENDING",
    documentNumber: "LCBP3-RFA-001",
    createdAt: new Date().toISOString(),
    highlight: "Approval for <b>Concrete Mix</b> Design",
  },
  {
    id: 1,
    type: "drawing",
    title: "Ground Floor Plan",
    description: "Architectural ground floor plan.",
    status: "APPROVED",
    documentNumber: "A-101",
    createdAt: new Date(Date.now() - 100000000).toISOString(),
    highlight: "Ground Floor <b>Plan</b>",
  },
  {
    id: 2,
    type: "correspondence",
    title: "Request for Information regarding Foundation",
    description: "Clarification needed on drawing A-101.",
    status: "IN_REVIEW",
    documentNumber: "LCBP3-COR-002",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const searchApi = {
  search: async (filters: SearchFilters) => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    let results = [...mockResults];

    if (filters.query) {
      const lowerQuery = filters.query.toLowerCase();
      results = results.filter((r) =>
        r.title.toLowerCase().includes(lowerQuery) ||
        r.documentNumber.toLowerCase().includes(lowerQuery) ||
        r.description?.toLowerCase().includes(lowerQuery)
      );
    }

    if (filters.types && filters.types.length > 0) {
      results = results.filter((r) => filters.types?.includes(r.type));
    }

    if (filters.statuses && filters.statuses.length > 0) {
      results = results.filter((r) => filters.statuses?.includes(r.status));
    }

    return results;
  },

  suggest: async (query: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const lowerQuery = query.toLowerCase();
    return mockResults
      .filter((r) => r.title.toLowerCase().includes(lowerQuery))
      .slice(0, 5);
  },
};
