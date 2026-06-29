import { Drawing } from '@/types/drawing';

// Mock Data
const mockDrawings: Drawing[] = [
  {
    publicId: 'dwg-001',
    drawingNumber: 'S-201-A',
    title: 'Structural Foundation Plan',
    discipline: 'Structural',
    status: 'APPROVED',
    revision: 'A',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    publicId: 'dwg-002',
    drawingNumber: 'A-101-B',
    title: 'Architectural Floor Plan - Level 1',
    discipline: 'Architectural',
    status: 'IN_REVIEW',
    revision: 'B',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

export const drawingApi = {
  getAll: async (): Promise<{ data: Drawing[]; meta: { total: number } }> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { data: mockDrawings, meta: { total: mockDrawings.length } };
  },

  getById: async (_id: string): Promise<Drawing | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockDrawings.find((d) => d.publicId === _id);
  },

  getByContract: async (_contractId: string): Promise<{ data: Drawing[] }> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Mock: return all drawings for any contract
    return { data: mockDrawings };
  },
};
