// File: src/types/dto/correspondence/workflow-action.dto.ts

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'RETURN' | 'ACKNOWLEDGE' | 'FORWARD';

export interface WorkflowActionDto {
  /** การกระทำ (Approve, Reject, etc.) */
  action: WorkflowAction; 

  /** ความคิดเห็นเพิ่มเติม */
  comments?: string;

  /** * ลำดับที่ต้องการส่งกลับ (ใช้กรณี action = RETURN) 
   * เช่น ส่งกลับไป step 1
   */
  returnToSequence?: number;
}