// File: src/types/dto/json-schema/json-schema.dto.ts

// --- Create ---
export interface CreateJsonSchemaDto {
  /** รหัส Schema (ต้องไม่ซ้ำ เช่น 'RFA_DWG_V1') */
  schemaCode: string;

  /** เวอร์ชัน (Default: 1) */
  version?: number;

  /** โครงสร้าง JSON Schema (Standard Format) */
  schemaDefinition: Record<string, any>;

  /** สถานะการใช้งาน */
  isActive?: boolean;
}

// --- Update (Partial) ---
export interface UpdateJsonSchemaDto extends Partial<CreateJsonSchemaDto> {}

// --- Search ---
export interface SearchJsonSchemaDto {
  /** ค้นหาจาก schemaCode */
  search?: string;

  /** กรองตามสถานะ */
  isActive?: boolean;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  limit?: number;
}