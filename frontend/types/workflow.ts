export type WorkflowType = 'CORRESPONDENCE' | 'RFA' | 'DRAWING';

// ADR-021: ระดับความเร่งด่วน (แสดงด้วย Badge สี)
export type WorkflowPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

// ADR-021: ข้อมูลสรุปไฟล์แนบประจำ Step
export interface WorkflowAttachmentSummary {
  publicId: string;
  originalFilename: string;
  mimeType?: string;
  fileSize?: number;
}

// ADR-021: รายการประวัติการเปลี่ยนสถานะพร้อมไฟล์แนบ
export interface WorkflowHistoryItem {
  id: string;
  fromState: string;
  toState: string;
  action: string;
  actionByUserId?: number;
  comment?: string;
  metadata?: Record<string, unknown>;
  attachments?: WorkflowAttachmentSummary[];
  createdAt: string;
}

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
