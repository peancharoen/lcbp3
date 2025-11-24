// File: src/common/decorators/bypass-maintenance.decorator.ts
// บันทึกการแก้ไข: ใช้สำหรับยกเว้นการตรวจสอบ Maintenance Mode (T1.1)

import { SetMetadata } from '@nestjs/common';

export const BYPASS_MAINTENANCE_KEY = 'bypass_maintenance';

// ใช้ @BypassMaintenance() บน Controller หรือ Method ที่ต้องการให้ทำงานได้แม้ปิดระบบ
export const BypassMaintenance = () =>
  SetMetadata(BYPASS_MAINTENANCE_KEY, true);
