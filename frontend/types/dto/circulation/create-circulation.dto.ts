// File: src/types/dto/circulation/create-circulation.dto.ts

export interface CreateCirculationDto {
  /** เอกสารต้นเรื่องที่จะเวียน (Correspondence ID) */
  correspondenceId: number; 

  /** หัวข้อเรื่อง (Subject) */
  subject: string; 

  /** รายชื่อ User ID ที่ต้องการส่งให้ (ผู้รับผิดชอบ) */
  assigneeIds: number[]; 

  /** หมายเหตุเพิ่มเติม (ถ้ามี) */
  remarks?: string; 
}