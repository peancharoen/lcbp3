import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
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
  @IsNotEmpty()
  assigneeIds!: number[]; // รายชื่อ User ID ที่ต้องการส่งให้ (ผู้รับผิดชอบ)

  @IsString()
  @IsOptional()
  remarks?: string; // หมายเหตุเพิ่มเติม (ถ้ามี)
}
