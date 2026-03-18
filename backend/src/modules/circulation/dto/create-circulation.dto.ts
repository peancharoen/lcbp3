import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';

export class CreateCirculationDto {
  @IsNotEmpty()
  correspondenceId!: number | string; // เอกสารต้นเรื่องที่จะเวียน (INT or UUID)

  @IsOptional()
  projectId?: number | string; // Project ID or UUID for Numbering

  @IsString()
  @IsNotEmpty()
  subject!: string; // หัวข้อเรื่อง (Subject)

  @IsArray()
  @ArrayMinSize(1) // ✅ ต้องมีผู้รับอย่างน้อย 1 คน
  assigneeIds!: (number | string)[]; // รายชื่อ User ID or UUID ที่ต้องการส่งให้ (ADR-019)

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุเพิ่มเติม (ถ้ามี)
}
