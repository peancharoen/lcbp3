// File: src/types/dto/correspondence/create-correspondence.dto.ts

export interface CreateCorrespondenceDto {
  /** UUID ของโครงการ (ADR-019) */
  projectId: string;

  /** ID ของประเภทเอกสาร (เช่น RFA, LETTER) - Master data ใช้ INT */
  typeId: number;

  /** [Req 6B] สาขางาน (เช่น GEN, STR) - Master data ใช้ INT */
  disciplineId?: number;

  /** [Req 6B] ประเภทย่อย (เช่น MAT, SHP สำหรับ Transmittal/RFA) - Master data ใช้ INT */
  subTypeId?: number;

  /** หัวข้อเอกสาร */
  subject: string;

  /** รายละเอียดเพิ่มเติม (Optional) */
  description?: string;

  /** เนื้อหาเอกสาร (Rich Text) */
  body?: string;

  /** หมายเหตุ */
  remarks?: string;

  /** กำหนดวันตอบกลับ (ISO Date String) */
  dueDate?: string;

  /** วันที่เอกสาร (ISO Date String) */
  documentDate?: string;

  /** วันที่ออกเอกสาร (ISO Date String) */
  issuedDate?: string;

  /** วันที่รับเอกสาร (ISO Date String) */
  receivedDate?: string;

  /** ข้อมูล JSON เฉพาะประเภท (เช่น RFI question, RFA details) */
  details?: Record<string, unknown>;

  /** เอกสารภายในหรือไม่ (True = ภายใน) */
  isInternal?: boolean;

  /** * ✅ Field สำหรับ Impersonation (เลือกองค์กรผู้ส่ง)
   * ใช้กรณี Admin สร้างเอกสารแทนผู้อื่น (ADR-019: UUID)
   */
  originatorId?: string;

  /** Temp IDs from two-phase file upload (POST /files/upload → tempId) */
  attachmentTempIds?: string[];

  /** รายชื่อผู้รับ (ADR-019: organizationId เป็น UUID) */
  recipients?: { organizationId: string; type: 'TO' | 'CC' }[];
}
