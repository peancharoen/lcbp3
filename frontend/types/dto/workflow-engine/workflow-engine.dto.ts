// File: src/types/dto/workflow-engine/workflow-engine.dto.ts

// --- Create Definition ---
export interface CreateWorkflowDefinitionDto {
  /** รหัสของ Workflow (เช่น 'RFA', 'CORRESPONDENCE') */
  workflow_code: string;

  /** นิยาม Workflow (DSL JSON Object) */
  dsl: any;

  /** เปิดใช้งานทันทีหรือไม่ (Default: true) */
  is_active?: boolean;
}

// --- Update Definition ---
export interface UpdateWorkflowDefinitionDto extends Partial<CreateWorkflowDefinitionDto> {}

// --- Evaluate (ประมวลผล/ตรวจสอบ State) ---
export interface EvaluateWorkflowDto {
  /** รหัส Workflow */
  workflow_code: string;

  /** สถานะปัจจุบัน */
  current_state: string;

  /** Action ที่ต้องการทำ (เช่น 'SUBMIT', 'APPROVE') */
  action: string;

  /** Context ข้อมูลเพิ่มเติม (เช่น User ID, Data) */
  context?: Record<string, any>;
}

// --- Get Available Actions ---
export interface GetAvailableActionsDto {
  /** รหัส Workflow */
  workflow_code: string;

  /** สถานะปัจจุบัน */
  current_state: string;
}