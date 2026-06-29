import { Workflow, CreateWorkflowDto, ValidationResult } from '@/types/workflow';

// Mock Data
let mockWorkflows: Workflow[] = [
  {
    publicId: 'wf-001',
    workflowId: 1,
    workflowName: 'Standard RFA Workflow',
    description: 'Default approval process for RFAs',
    workflowType: 'RFA',
    version: 1,
    isActive: true,
    dslDefinition: `name: Standard RFA Workflow
steps:
  - name: Review
    type: REVIEW
    role: CM
    next: Approval
  - name: Approval
    type: APPROVAL
    role: PM`,
    stepCount: 2,
    updatedAt: new Date().toISOString(),
  },
  {
    publicId: 'wf-002',
    workflowId: 2,
    workflowName: 'Correspondence Review',
    description: 'Incoming correspondence review flow',
    workflowType: 'CORRESPONDENCE',
    version: 2,
    isActive: true,
    dslDefinition: `name: Correspondence Review
steps:
  - name: Initial Review
    type: REVIEW
    role: DC`,
    stepCount: 1,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const workflowApi = {
  getWorkflows: async (): Promise<Workflow[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockWorkflows];
  },

  getWorkflow: async (id: string): Promise<Workflow | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockWorkflows.find((w) => w.publicId === id);
  },

  createWorkflow: async (data: CreateWorkflowDto): Promise<Workflow> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const maxId = mockWorkflows.length > 0 ? Math.max(...mockWorkflows.map((w) => Number(w.workflowId ?? 0))) : 0;
    const newWorkflow: Workflow = {
      publicId: `wf-${String(maxId + 1).padStart(3, '0')}`,
      workflowId: maxId + 1,
      ...data,
      version: 1,
      isActive: true,
      stepCount: 0, // Simplified for mock
      updatedAt: new Date().toISOString(),
    };
    mockWorkflows.push(newWorkflow);
    return newWorkflow;
  },

  updateWorkflow: async (id: string, data: Partial<CreateWorkflowDto>): Promise<Workflow> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const index = mockWorkflows.findIndex((w) => w.publicId === id);
    if (index === -1) throw new Error('Workflow not found');

    const updatedWorkflow = { ...mockWorkflows[index], ...data, updatedAt: new Date().toISOString() };
    mockWorkflows[index] = updatedWorkflow;
    return updatedWorkflow;
  },

  validateDSL: async (dsl: string): Promise<ValidationResult> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Simple mock validation
    if (!dsl.includes('name:') || !dsl.includes('steps:')) {
      return { valid: false, errors: ["Missing 'name' or 'steps' field"] };
    }
    return { valid: true, errors: [] };
  },
};
