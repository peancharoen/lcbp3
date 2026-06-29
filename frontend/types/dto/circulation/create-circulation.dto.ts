// File: src/types/dto/circulation/create-circulation.dto.ts

export interface CreateCirculationDto {
  /** เอกสารต้นเรื่องที่จะเวียน (Correspondence ID or UUID) */
  correspondenceId: number | string;

  /** หัวข้อเรื่อง (Subject) */
  subject: string;

  /** รายชื่อ User ID/UUID ที่ต้องการส่งให้ (ผู้รับผิดชอบ) */
  assigneeIds: (number | string)[];

  /** หมายเหตุเพิ่มเติม (ถ้ามี) */
  remarks?: string;
}
