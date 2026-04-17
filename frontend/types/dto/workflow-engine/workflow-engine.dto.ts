// File: src/types/dto/workflow-engine/workflow-engine.dto.ts

/** DSL JSON structure representing a Workflow definition.
 * Uses an open-ended signature to support diverse workflow types (YAML-derived, visual, etc.)
 */
export interface WorkflowDsl {
  /** Allow extra properties for different DSL formats */
  [key: string]: unknown;
  states?: Record<string, WorkflowState>;
  initialState?: string;
}

export interface WorkflowState {
  transitions?: WorkflowTransition[];
  onEnter?: string[];
  onExit?: string[];
}

export interface WorkflowTransition {
  action: string;
  target: string;
  conditions?: string[];
  roles?: string[];
}

// --- Create Definition ---
export interface CreateWorkflowDefinitionDto {
  /** รหัสของ Workflow (เช่น 'RFA', 'CORRESPONDENCE') */
  workflowCode: string;

  /** นิยาม Workflow (DSL JSON Object) */
  dsl: WorkflowDsl;

  /** เปิดใช้งานทันทีหรือไม่ (Default: true) */
  isActive?: boolean;
}

// --- Update Definition ---
export type UpdateWorkflowDefinitionDto = Partial<CreateWorkflowDefinitionDto>;

// --- Evaluate (ประมวลผล/ตรวจสอบ State) ---
export interface EvaluateWorkflowDto {
  /** รหัส Workflow */
  workflowCode: string;

  /** สถานะปัจจุบัน */
  currentState: string;

  /** Action ที่ต้องการทำ (เช่น 'SUBMIT', 'APPROVE') */
  action: string;

  /** Context ข้อมูลเพิ่มเติม (เช่น User ID, Data) */
  context?: Record<string, unknown>;
}

// --- Get Available Actions ---
export interface GetAvailableActionsDto {
  /** รหัส Workflow */
  workflowCode: string;

  /** สถานะปัจจุบัน */
  currentState: string;
}

// --- ADR-021: Workflow Transition with Step Attachments ---
export interface WorkflowTransitionWithAttachmentsDto {
  /** ชื่อ Action (ต้องตรงกับ DSL) เช่น APPROVE, REJECT */
  action: string;

  /** ความเห็นประกอบการดำเนินการ */
  comment?: string;

  /** ข้อมูลเพิ่มเติม */
  payload?: Record<string, unknown>;

  /** รายการ publicId ของไฟล์แนบประจำ Step นี้ (max 20, ADR-016 Two-Phase upload) */
  attachmentPublicIds?: string[];
}
