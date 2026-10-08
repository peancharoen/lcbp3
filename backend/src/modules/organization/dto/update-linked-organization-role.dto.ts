// File: backend/src/modules/organization/dto/update-linked-organization-role.dto.ts
// Change Log:
// - 2026-10-08: สร้าง DTO สำหรับเปลี่ยน role ขององค์กรที่ผูกกับ Project/Contract แล้ว
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับเปลี่ยน role ของ junction row (project_organizations / contract_organizations)
 */
export class UpdateLinkedOrganizationRoleDto {
  @ApiProperty({
    description: 'role_name ใหม่ใน organization_roles เช่ DESIGNER, CONSULTANT',
  })
  @IsString()
  @IsNotEmpty()
  roleName!: string;
}
