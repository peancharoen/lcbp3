import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ArrayMinSize, // ✅ เพิ่ม
} from 'class-validator';

export class CreateCirculationDto {
  @IsInt()
  @IsNotEmpty()
  correspondenceId!: number; // เอกสารต้นเรื่องที่จะเวียน

  @IsString()
  @IsNotEmpty()
  subject!: string; // หัวข้อเรื่อง (Subject)

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1) // ✅ ต้องมีผู้รับอย่างน้อย 1 คน
  assigneeIds!: number[]; // รายชื่อ User ID ที่ต้องการส่งให้ (ผู้รับผิดชอบ)

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุเพิ่มเติม (ถ้ามี)
}
