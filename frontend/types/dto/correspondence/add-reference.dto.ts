// File: src/types/dto/correspondence/add-reference.dto.ts

export interface AddReferenceDto {
  /** ID ของเอกสารที่ต้องการอ้างอิงถึง */
  targetId: number;
}

export interface RemoveReferenceDto {
  /** ID ของเอกสารที่ต้องการลบการอ้างอิง */
  targetId: number;
}