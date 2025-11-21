import { IsInt, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class AssignRoleDto {
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @IsInt()
  @IsNotEmpty()
  roleId!: number;

  // Scope (ต้องส่งมาอย่างน้อย 1 อัน หรือไม่ส่งเลยถ้าเป็น Global)
  @IsInt()
  @IsOptional()
  organizationId?: number;

  @IsInt()
  @IsOptional()
  projectId?: number;

  @IsInt()
  @IsOptional()
  contractId?: number;
}
