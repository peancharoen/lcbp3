import { Drawing, CreateDrawingDto, DrawingRevision } from "@/types/drawing";

// Mock Data
const mockDrawings: Drawing[] = [
  {
    drawing_id: 1,
    drawing_number: "A-101",
    title: "Ground Floor Plan",
    type: "CONTRACT",
    discipline_id: 2,
    discipline: { id: 2, discipline_code: "ARC", discipline_name: "Architecture" },
    sheet_number: "01",
    scale: "1:100",
    current_revision: "0",
    issue_date: new Date(Date.now() - 100000000).toISOString(),
    revision_count: 1,
    revisions: [
      {
        revision_id: 1,
        revision_number: "0",
        revision_date: new Date(Date.now() - 100000000).toISOString(),
        revision_description: "Issued for Construction",
        revised_by_name: "John Doe",
        file_url: "/mock-drawing.pdf",
        is_current: true,
      },
    ],
  },
  {
    drawing_id: 2,
    drawing_number: "S-201",
    title: "Foundation Details",
    type: "SHOP",
    discipline_id: 1,
    discipline: { id: 1, discipline_code: "STR", discipline_name: "Structure" },
    sheet_number: "05",
    scale: "1:50",
    current_revision: "B",
    issue_date: new Date().toISOString(),
    revision_count: 2,
    revisions: [
      {
        revision_id: 3,
        revision_number: "B",
        revision_date: new Date().toISOString(),
        revision_description: "Updated reinforcement",
        revised_by_name: "Jane Smith",
        file_url: "/mock-drawing-v2.pdf",
        is_current: true,
      },
      {
        revision_id: 2,
        revision_number: "A",
        revision_date: new Date(Date.now() - 50000000).toISOString(),
        revision_description: "First Submission",
        revised_by_name: "Jane Smith",
        file_url: "/mock-drawing-v1.pdf",
        is_current: false,
      },
    ],
  },
];

export const drawingApi = {
  getAll: async (params?: { type?: "CONTRACT" | "SHOP"; search?: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    let filtered = [...mockDrawings];
    if (params?.type) {
      filtered = filtered.filter((d) => d.type === params.type);
    }
    if (params?.search) {
      const lowerSearch = params.search.toLowerCase();
      filtered = filtered.filter((d) =>
        d.drawing_number.toLowerCase().includes(lowerSearch) ||
        d.title.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  },

  getById: async (id: number) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockDrawings.find((d) => d.drawing_id === id);
  },

  create: async (data: CreateDrawingDto) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const newId = Math.max(...mockDrawings.map((d) => d.drawing_id)) + 1;
    const newDrawing: Drawing = {
      drawing_id: newId,
      drawing_number: data.drawing_number,
      title: data.title,
      type: data.drawing_type,
      discipline_id: data.discipline_id,
      discipline: { id: data.discipline_id, discipline_code: "MOCK", discipline_name: "Mock Discipline" },
      sheet_number: data.sheet_number,
      scale: data.scale,
      current_revision: "0",
      issue_date: new Date().toISOString(),
      revision_count: 1,
      revisions: [
        {
          revision_id: newId * 10,
          revision_number: "0",
          revision_date: new Date().toISOString(),
          revision_description: "Initial Upload",
          revised_by_name: "Current User",
          file_url: "#",
          is_current: true,
        }
      ]
    };

    mockDrawings.unshift(newDrawing);
    return newDrawing;
  },
};
