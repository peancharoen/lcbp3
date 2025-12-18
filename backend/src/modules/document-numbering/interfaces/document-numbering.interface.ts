// File: src/modules/document-numbering/interfaces/document-numbering.interface.ts

export interface GenerateNumberContext {
  projectId: number;
  originatorOrganizationId: number; // องค์กรผู้ส่ง
  typeId: number; // ประเภทเอกสาร (Correspondence Type ID)
  subTypeId?: number; // (Optional) Sub Type ID (สำหรับ Transmittal)
  rfaTypeId?: number; // [v1.5.1] RFA Type: SHD, RPT, MAT (0 = not RFA)
  disciplineId?: number; // (Optional) Discipline ID (สาขางาน)
  year?: number; // (Optional) ถ้าไม่ส่งจะใช้ปีปัจจุบัน

  // [v1.5.1] Recipient organization for counter key
  recipientOrganizationId?: number; // Primary recipient (-1 = all orgs)

  // [P0-4] Audit tracking fields
  userId?: number; // User requesting the number
  ipAddress?: string; // IP address of the requester

  // สำหรับกรณีพิเศษที่ต้องการ Override ค่าบางอย่าง
  customTokens?: Record<string, string>;
}

export type DecodedTokens = Record<string, string>;
