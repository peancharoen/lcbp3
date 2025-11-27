// File: src/types/dto/correspondence/create-correspondence.dto.ts

export interface CreateCorrespondenceDto {
  /** ID ของโครงการ */
  projectId: number;

  /** ID ของประเภทเอกสาร (เช่น RFA, LETTER) */
  typeId: number; 
  
  /** [Req 6B] สาขางาน (เช่น GEN, STR) */
  disciplineId?: number; 

  /** [Req 6B] ประเภทย่อย (เช่น MAT, SHP สำหรับ Transmittal/RFA) */
  subTypeId?: number;
 
  /** หัวข้อเอกสาร */
  title: string;

  /** รายละเอียดเพิ่มเติม (Optional) */
  description?: string;

  /** ข้อมูล JSON เฉพาะประเภท (เช่น RFI question, RFA details) */
  details?: Record<string, any>;

  /** เอกสารภายในหรือไม่ (True = ภายใน) */
  isInternal?: boolean;

  /** * ✅ Field สำหรับ Impersonation (เลือกองค์กรผู้ส่ง)
   * ใช้กรณี Admin สร้างเอกสารแทนผู้อื่น
   */
  originatorId?: number;
}