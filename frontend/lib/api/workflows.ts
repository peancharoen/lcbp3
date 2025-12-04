import { Workflow, CreateWorkflowDto, ValidationResult } from "@/types/workflow";

// Mock Data
let mockWorkflows: Workflow[] = [
  {
    workflow_id: 1,
    workflow_name: "Standard RFA Workflow",
    description: "Default approval process for RFAs",
    workflow_type: "RFA",
    version: 1,
    is_active: true,
    dsl_definition: `name: Standard RFA Workflow
steps:
  - name: Review
    type: REVIEW
    role: CM
    next: Approval
  - name: Approval
    type: APPROVAL
    role: PM`,
    step_count: 2,
    updated_at: new Date().toISOString(),
  },
  {
    workflow_id: 2,
    workflow_name: "Correspondence Review",
    description: "Incoming correspondence review flow",
    workflow_type: "CORRESPONDENCE",
    version: 2,
    is_active: true,
    dsl_definition: `name: Correspondence Review
steps:
  - name: Initial Review
    type: REVIEW
    role: DC`,
    step_count: 1,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const workflowApi = {
  getWorkflows: async (): Promise<Workflow[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockWorkflows];
  },

  getWorkflow: async (id: number): Promise<Workflow | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockWorkflows.find((w) => w.workflow_id === id);
  },

  createWorkflow: async (data: CreateWorkflowDto): Promise<Workflow> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newWorkflow: Workflow = {
      workflow_id: Math.max(...mockWorkflows.map((w) => w.workflow_id)) + 1,
      ...data,
      version: 1,
      is_active: true,
      step_count: 0, // Simplified for mock
      updated_at: new Date().toISOString(),
    };
    mockWorkflows.push(newWorkflow);
    return newWorkflow;
  },

  updateWorkflow: async (id: number, data: Partial<CreateWorkflowDto>): Promise<Workflow> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const index = mockWorkflows.findIndex((w) => w.workflow_id === id);
    if (index === -1) throw new Error("Workflow not found");

    const updatedWorkflow = { ...mockWorkflows[index], ...data, updated_at: new Date().toISOString() };
    mockWorkflows[index] = updatedWorkflow;
    return updatedWorkflow;
  },

  validateDSL: async (dsl: string): Promise<ValidationResult> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Simple mock validation
    if (!dsl.includes("name:") || !dsl.includes("steps:")) {
      return { valid: false, errors: ["Missing 'name' or 'steps' field"] };
    }
    return { valid: true, errors: [] };
  },
};
