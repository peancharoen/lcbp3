// File: src/types/dto/master/tag.dto.ts

export interface CreateTagDto {
  /** ID โครงการ (NULL = Global) */
  project_id?: number | null;

  /** ชื่อ Tag (เช่น 'URGENT') */
  tag_name: string;

  /** รหัสสี หรือชื่อคลาสสำหรับ UI */
  color_code?: string;

  /** คำอธิบาย */
  description?: string;
}

export type UpdateTagDto = Partial<CreateTagDto>;

export interface SearchTagDto {
  /** ID โครงการ (ใช้กรอง Tag ของแต่ละโปรเจกต์) */
  project_id?: number;

  /** คำค้นหา (ชื่อ Tag หรือ คำอธิบาย) */
  search?: string;

  /** หมายเลขหน้า (เริ่มต้น 1) */
  page?: number;

  /** จำนวนรายการต่อหน้า (Default: 20) */
  limit?: number;
}
