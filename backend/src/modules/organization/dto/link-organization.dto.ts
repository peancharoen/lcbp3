// File: backend/src/modules/organization/dto/link-organization.dto.ts
// Change Log:
// - 2026-10-08: สร้าง DTO สำหรับผูก Organization เข้า Project/Contract พร้อม role
//   (deferred จาก PR #29 — role ของ org มีความหมายเฉพาะใน context นั้น ๆ)
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับผูกองค์กรเข้ากับ Project หรือ Contract
 * - organizationId เป็น publicId (UUID) ของ Organization — ADR-019
 * - roleName เป็น natural key ของ organization_roles (ตารางไม่มี uuid)
 */
export class LinkOrganizationDto {
  @ApiProperty({ description: 'publicId (UUID) ขององค์กรที่ต้องการผูก' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({
    description: 'role_name ใน organization_roles เช่น OWNER, CONTRACTOR',
  })
  @IsString()
  @IsNotEmpty()
  roleName!: string;
}
