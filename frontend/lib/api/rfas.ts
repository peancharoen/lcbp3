import { RFA, CreateRFADto, RFAItem } from "@/types/rfa";

// Mock Data
const mockRFAs: RFA[] = [
  {
    rfa_id: 1,
    rfa_number: "LCBP3-RFA-001",
    subject: "Approval for Concrete Mix Design",
    description: "Requesting approval for the proposed concrete mix design for foundations.",
    contract_id: 1,
    discipline_id: 1,
    status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contract_name: "Main Construction Contract",
    discipline_name: "Civil",
    items: [
      { id: 1, item_no: "1.1", description: "Concrete Mix Type A", quantity: 1, unit: "Lot", status: "PENDING" },
      { id: 2, item_no: "1.2", description: "Concrete Mix Type B", quantity: 1, unit: "Lot", status: "PENDING" },
    ],
  },
  {
    rfa_id: 2,
    rfa_number: "LCBP3-RFA-002",
    subject: "Approval for Steel Reinforcement Shop Drawings",
    description: "Shop drawings for Zone A foundations.",
    contract_id: 1,
    discipline_id: 2,
    status: "APPROVED",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    contract_name: "Main Construction Contract",
    discipline_name: "Structural",
    items: [
      { id: 3, item_no: "1", description: "Shop Drawing Set A", quantity: 1, unit: "Set", status: "APPROVED" },
    ],
  },
];

export const rfaApi = {
  getAll: async (params?: { page?: number; status?: string; search?: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    let filtered = [...mockRFAs];
    if (params?.status) {
      filtered = filtered.filter((r) => r.status === params.status);
    }
    if (params?.search) {
      const lowerSearch = params.search.toLowerCase();
      filtered = filtered.filter((r) =>
        r.subject.toLowerCase().includes(lowerSearch) ||
        r.rfa_number.toLowerCase().includes(lowerSearch)
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
    return mockRFAs.find((r) => r.rfa_id === id);
  },

  create: async (data: CreateRFADto) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const newId = Math.max(...mockRFAs.map((r) => r.rfa_id)) + 1;
    const newRFA: RFA = {
      rfa_id: newId,
      rfa_number: `LCBP3-RFA-00${newId}`,
      ...data,
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contract_name: "Mock Contract",
      discipline_name: "Mock Discipline",
      items: data.items.map((item, index) => ({ ...item, id: index + 1, status: "PENDING" })),
    };

    mockRFAs.unshift(newRFA);
    return newRFA;
  },

  updateStatus: async (id: number, status: RFA['status'], comments?: string) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const rfa = mockRFAs.find((r) => r.rfa_id === id);
    if (rfa) {
      rfa.status = status;
      rfa.updated_at = new Date().toISOString();
      // In a real app, we'd log the comments and history
    }
    return rfa;
  },
};
