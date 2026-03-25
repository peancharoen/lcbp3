// File: src/types/dto/master/tag.dto.ts

export interface CreateTagDto {
  /** ID โครงการ (NULL = Global) */
  projectId?: number | null;

  /** ชื่อ Tag (เช่น 'URGENT') */
  tagName: string;

  /** รหัสสี หรือชื่อคลาสสำหรับ UI */
  colorCode?: string;

  /** คำอธิบาย */
  description?: string;
}

export type UpdateTagDto = Partial<CreateTagDto>;

export interface SearchTagDto {
  /** ID โครงการ (ใช้กรอง Tag ของแต่ละโปรเจกต์) */
  projectId?: number;

  /** คำค้นหา (ชื่อ Tag หรือ คำอธิบาย) */
  search?: string;

  /** หมายเลขหน้า (เริ่มต้น 1) */
  page?: number;

  /** จำนวนรายการต่อหน้า (Default: 20) */
  limit?: number;
}
