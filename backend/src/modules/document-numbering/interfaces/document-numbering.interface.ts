// File: src/modules/document-numbering/interfaces/document-numbering.interface.ts

export interface GenerateNumberContext {
  projectId: number;
  originatorId: number; // องค์กรผู้ส่ง
  typeId: number; // ประเภทเอกสาร (Correspondence Type ID)
  subTypeId?: number; // (Optional) Sub Type ID (สำหรับ RFA/Transmittal)
  disciplineId?: number; // (Optional) Discipline ID (สาขางาน)
  year?: number; // (Optional) ถ้าไม่ส่งจะใช้ปีปัจจุบัน

  // สำหรับกรณีพิเศษที่ต้องการ Override ค่าบางอย่าง
  customTokens?: Record<string, string>;
}

export interface DecodedTokens {
  projectCode: string;
  orgCode: string;
  typeCode: string;
  disciplineCode: string;
  subTypeCode: string;
  subTypeNumber: string;
  year: string;
  yearShort: string;
}
