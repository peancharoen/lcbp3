// File: src/types/dto/correspondence/add-reference.dto.ts

export interface AddReferenceDto {
  /** UUID ของเอกสารที่ต้องการอ้างอิงถึง (ADR-019) */
  targetUuid: string;
}

export interface RemoveReferenceDto {
  /** UUID ของเอกสารที่ต้องการลบการอ้างอิง (ADR-019) */
  targetUuid: string;
}
