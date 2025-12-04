export type WorkflowType = "CORRESPONDENCE" | "RFA" | "DRAWING";

export interface WorkflowStep {
  step_id?: string;
  step_name: string;
  step_type: "APPROVAL" | "REVIEW" | "ENDORSEMENT";
  approver_role_id?: number;
  approver_role_name?: string;
  next_step_success?: string;
  next_step_failure?: string;
}

export interface Workflow {
  workflow_id: number;
  workflow_name: string;
  description: string;
  workflow_type: WorkflowType;
  version: number;
  is_active: boolean;
  dsl_definition: string;
  step_count: number;
  updated_at: string;
}

export interface CreateWorkflowDto {
  workflow_name: string;
  description: string;
  workflow_type: WorkflowType;
  dsl_definition: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
