import { Correspondence, CreateCorrespondenceDto } from "@/types/correspondence";

// Mock Data
const mockCorrespondences: Correspondence[] = [
  {
    correspondence_id: 1,
    document_number: "LCBP3-COR-001",
    subject: "Submission of Monthly Report - Jan 2025",
    description: "Please find attached the monthly progress report.",
    status: "PENDING",
    importance: "NORMAL",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    from_organization_id: 1,
    to_organization_id: 2,
    document_type_id: 1,
    from_organization: { id: 1, org_name: "Contractor A", org_code: "CON-A" },
    to_organization: { id: 2, org_name: "Owner", org_code: "OWN" },
  },
  {
    correspondence_id: 2,
    document_number: "LCBP3-COR-002",
    subject: "Request for Information regarding Foundation",
    description: "Clarification needed on drawing A-101.",
    status: "IN_REVIEW",
    importance: "HIGH",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    from_organization_id: 2,
    to_organization_id: 1,
    document_type_id: 1,
    from_organization: { id: 2, org_name: "Owner", org_code: "OWN" },
    to_organization: { id: 1, org_name: "Contractor A", org_code: "CON-A" },
  },
];

export const correspondenceApi = {
  getAll: async (params?: { page?: number; status?: string; search?: string }) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    let filtered = [...mockCorrespondences];
    if (params?.status) {
      filtered = filtered.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const lowerSearch = params.search.toLowerCase();
      filtered = filtered.filter((c) =>
        c.subject.toLowerCase().includes(lowerSearch) ||
        c.document_number.toLowerCase().includes(lowerSearch)
      );
    }

    return {
      items: filtered,
      total: filtered.length,
      page: params?.page || 1,
      totalPages: 1,
    };
  },

  getById: async (id: number) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockCorrespondences.find((c) => c.correspondence_id === id);
  },

  create: async (data: CreateCorrespondenceDto) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const newId = Math.max(...mockCorrespondences.map((c) => c.correspondence_id)) + 1;
    const newCorrespondence: Correspondence = {
      correspondence_id: newId,
      document_number: `LCBP3-COR-00${newId}`,
      ...data,
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Mock organizations for display
      from_organization: { id: data.from_organization_id, org_name: "Mock Org From", org_code: "MOCK" },
      to_organization: { id: data.to_organization_id, org_name: "Mock Org To", org_code: "MOCK" },
    } as Correspondence; // Casting for simplicity in mock

    mockCorrespondences.unshift(newCorrespondence);
    return newCorrespondence;
  },
};
