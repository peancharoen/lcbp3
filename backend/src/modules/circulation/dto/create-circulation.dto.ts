import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateCirculationDto {
  @IsNotEmpty()
  correspondenceId!: number | string; // เอกสารต้นเรื่องที่จะเวียน (INT or UUID)

  @IsOptional()
  projectId?: number | string; // Project ID or UUID for Numbering

  @IsOptional()
  originatorId?: number | string; // ระบุองค์กรเจ้าของเอกสาร (ต้องใช้ร่วมกับสิทธิ system.manage_all)

  @IsString()
  @IsNotEmpty()
  subject!: string; // หัวข้อเรื่อง (Subject)

  @IsArray()
  @IsOptional()
  assigneeIds?: (number | string)[]; // รายชื่อ User ID or UUID ที่ต้องการส่งให้ (ADR-019)

  @IsArray()
  @IsOptional()
  assigneeGroupIds?: (number | string)[]; // รายชื่อ User Group ID or UUID — claim-based: member คนแรกที่รับงานจะเป็น assignedTo

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุเพิ่มเติม (ถ้ามี)
}
