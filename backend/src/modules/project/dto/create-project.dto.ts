import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  projectCode!: string; // รหัสโครงการ (เช่น LCBP3)

  @IsString()
  @IsNotEmpty()
  projectName!: string; // ชื่อโครงการ

  @IsBoolean()
  @IsOptional()
  isActive?: boolean; // สถานะการใช้งาน (Default: true)
}
