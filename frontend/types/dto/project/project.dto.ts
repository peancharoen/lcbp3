// File: src/types/dto/project/project.dto.ts

// --- Create ---
export interface CreateProjectDto {
  /** รหัสโครงการ (เช่น LCBP3) */
  projectCode: string;

  /** ชื่อโครงการ */
  projectName: string;

  /** สถานะการใช้งาน (Default: true) */
  isActive?: boolean;
}

// --- Update (Partial) ---
export interface UpdateProjectDto extends Partial<CreateProjectDto> {}

// --- Search ---
export interface SearchProjectDto {
  /** ค้นหาจาก Project Code หรือ Name */
  search?: string;

  /** กรองตามสถานะ Active */
  isActive?: boolean;

  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนรายการต่อหน้า (Default: 20) */
  limit?: number;
}