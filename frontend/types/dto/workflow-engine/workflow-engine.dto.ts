// File: src/types/dto/workflow-engine/workflow-engine.dto.ts

/** DSL JSON structure representing a Workflow definition.
 * Uses an open-ended signature to support diverse workflow types (YAML-derived, visual, etc.)
 */
export interface WorkflowDsl {
  /** Allow extra properties for different DSL formats */
  [key: string]: unknown;
  states?: Record<string, WorkflowState>;
  initial_state?: string;
}

export interface WorkflowState {
  transitions?: WorkflowTransition[];
  on_enter?: string[];
  on_exit?: string[];
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
  workflow_code: string;

  /** นิยาม Workflow (DSL JSON Object) */
  dsl: WorkflowDsl;

  /** เปิดใช้งานทันทีหรือไม่ (Default: true) */
  is_active?: boolean;
}

// --- Update Definition ---
export type UpdateWorkflowDefinitionDto = Partial<CreateWorkflowDefinitionDto>;

// --- Evaluate (ประมวลผล/ตรวจสอบ State) ---
export interface EvaluateWorkflowDto {
  /** รหัส Workflow */
  workflow_code: string;

  /** สถานะปัจจุบัน */
  current_state: string;

  /** Action ที่ต้องการทำ (เช่น 'SUBMIT', 'APPROVE') */
  action: string;

  /** Context ข้อมูลเพิ่มเติม (เช่น User ID, Data) */
  context?: Record<string, unknown>;
}

// --- Get Available Actions ---
export interface GetAvailableActionsDto {
  /** รหัส Workflow */
  workflow_code: string;

  /** สถานะปัจจุบัน */
  current_state: string;
}
