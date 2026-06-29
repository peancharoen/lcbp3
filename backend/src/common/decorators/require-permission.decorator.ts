import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions'; // Changed from PERMISSION_KEY

/**
 * Decorator สำหรับกำหนด permissions ที่จำเป็นสำหรับ route
 * รองรับ multiple permissions (user ต้องมี ALL permissions)
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
