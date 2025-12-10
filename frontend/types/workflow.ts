export type WorkflowType = "CORRESPONDENCE" | "RFA" | "DRAWING";

export interface WorkflowStep {
  stepId?: string;
  stepName: string;
  stepType: "APPROVAL" | "REVIEW" | "ENDORSEMENT";
  approverRoleId?: number;
  approverRoleName?: string;
  nextStepSuccess?: string;
  nextStepFailure?: string;
}

export interface Workflow {
  workflowId: number;
  workflowName: string;
  description: string;
  workflowType: WorkflowType;
  version: number;
  isActive: boolean;
  dslDefinition: string;
  stepCount: number;
  updatedAt: string;
}

export interface CreateWorkflowDto {
  workflowName: string;
  description: string;
  workflowType: WorkflowType;
  dslDefinition: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
