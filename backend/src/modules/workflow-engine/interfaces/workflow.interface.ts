// สถานะของการดำเนินการในแต่ละขั้นตอน
export enum StepStatus {
  PENDING = 'PENDING', // รอถึงคิว
  IN_PROGRESS = 'IN_PROGRESS', // ถึงคิวแล้ว รอ action
  COMPLETED = 'COMPLETED', // อนุมัติ/ดำเนินการเรียบร้อย
  REJECTED = 'REJECTED', // ถูกปัดตก
  SKIPPED = 'SKIPPED', // ถูกข้าม
}

// การกระทำที่ผู้ใช้ทำได้
export enum WorkflowAction {
  APPROVE = 'APPROVE', // อนุมัติ / ยืนยัน / ส่งต่อ
  REJECT = 'REJECT', // ปฏิเสธ (จบ workflow ทันที)
  RETURN = 'RETURN', // ส่งกลับ (ไปแก้มาใหม่)
  ACKNOWLEDGE = 'ACKNOWLEDGE', // รับทราบ (สำหรับ For Info)
}

// ข้อมูลพื้นฐานของขั้นตอน (Step) ที่ Engine ต้องรู้
export interface WorkflowStep {
  sequence: number; // ลำดับที่ (1, 2, 3...)
  assigneeId?: number; // User ID ที่รับผิดชอบ (ถ้าเจาะจงคน)
  organizationId?: number; // Org ID ที่รับผิดชอบ (ถ้าเจาะจงหน่วยงาน)
  roleId?: number; // Role ID ที่รับผิดชอบ (ถ้าเจาะจงตำแหน่ง)
  status: StepStatus; // สถานะปัจจุบัน
}

// ผลลัพธ์ที่ Engine จะบอกเราหลังจากประมวลผลเสร็จ
export interface TransitionResult {
  nextStepSequence: number | null; // ขั้นตอนต่อไปคือเลขที่เท่าไหร่ (null = จบ workflow)
  shouldUpdateStatus: boolean; // ต้องอัปเดตสถานะเอกสารหลักไหม? (เช่น เปลี่ยนจาก IN_REVIEW เป็น APPROVED)
  documentStatus?: string; // สถานะเอกสารหลักที่ควรจะเป็น
}
