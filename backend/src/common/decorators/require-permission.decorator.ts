import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';

// ใช้สำหรับแปะหน้า Controller/Method
// ตัวอย่าง: @RequirePermission('user.create')
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
