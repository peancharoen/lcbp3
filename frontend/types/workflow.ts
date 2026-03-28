export type WorkflowType = 'CORRESPONDENCE' | 'RFA' | 'DRAWING';

export interface WorkflowStep {
  publicId: string; // ADR-019: public identifier
  stepId?: string; // Internal ID (excluded from API)
  stepName: string;
  stepType: 'APPROVAL' | 'REVIEW' | 'ENDORSEMENT';
  approverRoleId?: number;
  approverRoleName?: string;
  nextStepSuccess?: string;
  nextStepFailure?: string;
}

export interface Workflow {
  publicId: string; // ADR-019: public identifier
  workflowId?: string | number; // Internal ID (excluded from API)
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
