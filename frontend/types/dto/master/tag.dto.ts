// File: src/types/dto/master/tag.dto.ts

export interface CreateTagDto {
  /** ชื่อ Tag (เช่น 'URGENT') */
  tag_name: string;

  /** คำอธิบาย */
  description?: string;
}

export type UpdateTagDto = Partial<CreateTagDto>;

export interface SearchTagDto {
  /** คำค้นหา (ชื่อ Tag หรือ คำอธิบาย) */
  search?: string;

  /** หมายเลขหน้า (เริ่มต้น 1) */
  page?: number;

  /** จำนวนรายการต่อหน้า (Default: 20) */
  limit?: number;
}
