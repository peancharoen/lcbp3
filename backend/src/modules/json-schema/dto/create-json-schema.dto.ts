import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateJsonSchemaDto {
  @IsString()
  @IsNotEmpty()
  schemaCode!: string; // รหัส Schema (ต้องไม่ซ้ำ เช่น 'RFA_DWG_V1')

  @IsInt()
  @IsOptional()
  version?: number; // เวอร์ชัน (Default: 1)

  @IsObject()
  @IsNotEmpty()
  schemaDefinition!: Record<string, any>; // โครงสร้าง JSON Schema (Standard Format)

  @IsBoolean()
  @IsOptional()
  isActive?: boolean; // สถานะการใช้งาน
}
