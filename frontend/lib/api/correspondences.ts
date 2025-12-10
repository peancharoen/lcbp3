import { Correspondence, CreateCorrespondenceDto } from "@/types/correspondence";

// Mock Data
const mockCorrespondences: Correspondence[] = [
  {
    correspondenceId: 1,
    documentNumber: "PAT-CNPC-0001-2568",
    subject: "Request for Additional Information",
    description: "Please provide updated structural drawings for Phase 2",
    status: "IN_REVIEW",
    importance: "HIGH",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    fromOrganizationId: 1,
    toOrganizationId: 2,
    documentTypeId: 1,
    fromOrganization: { id: 1, orgName: "PAT", orgCode: "PAT" },
    toOrganization: { id: 2, orgName: "CNPC", orgCode: "CNPC" },
    attachments: [],
  },
];

export const correspondenceApi = {
  getAll: async (): Promise<{ data: Correspondence[]; meta: { total: number } }> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { data: mockCorrespondences, meta: { total: mockCorrespondences.length } };
  },

  getById: async (id: number): Promise<Correspondence | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockCorrespondences.find((c) => c.correspondenceId === id);
  },

  create: async (data: CreateCorrespondenceDto): Promise<Correspondence> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newCorrespondence: Correspondence = {
      correspondenceId: Math.max(...mockCorrespondences.map((c) => c.correspondenceId)) + 1,
      documentNumber: `PAT-CNPC-${String(mockCorrespondences.length + 1).padStart(4, "0")}-2568`,
      subject: data.subject,
      description: data.description,
      status: "DRAFT",
      importance: data.importance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fromOrganizationId: data.fromOrganizationId,
      toOrganizationId: data.toOrganizationId,
      documentTypeId: data.documentTypeId,
      attachments: [],
    };
    mockCorrespondences.push(newCorrespondence);
    return newCorrespondence;
  },
};
