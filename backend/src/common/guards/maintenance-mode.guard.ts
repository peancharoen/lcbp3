// File: src/common/guards/maintenance-mode.guard.ts
// บันทึกการแก้ไข: ตรวจสอบ Flag ใน Redis เพื่อ Block API ระหว่างปรับปรุงระบบ (T1.1)

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { BYPASS_MAINTENANCE_KEY } from '../decorators/bypass-maintenance.decorator';

@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceModeGuard.name);
  // Key ที่ใช้เก็บสถานะใน Redis (Admin จะเป็นคน Toggle ค่านี้)
  private readonly MAINTENANCE_KEY = 'system:maintenance_mode';

  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. ตรวจสอบว่า Route นี้ได้รับการยกเว้นหรือไม่ (Bypass)
    const isBypassed = this.reflector.getAllAndOverride<boolean>(
      BYPASS_MAINTENANCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isBypassed) {
      return true;
    }

    // 2. ตรวจสอบสถานะจาก Redis
    try {
      const isMaintenanceOn = await this.cacheManager.get(this.MAINTENANCE_KEY);

      // ถ้า Redis มีค่าเป็น true หรือ string "true" ให้ Block
      if (isMaintenanceOn === true || isMaintenanceOn === 'true') {
        // (Optional) 3. ตรวจสอบ Backdoor Header สำหรับ Admin (ถ้าต้องการ Bypass ฉุกเฉิน)
        const request = context.switchToHttp().getRequest();
        // const bypassToken = request.headers['x-maintenance-bypass'];
        // if (bypassToken === process.env.ADMIN_SECRET) return true;

        this.logger.warn(
          `Blocked request to ${request.url} due to Maintenance Mode`,
        );

        throw new ServiceUnavailableException({
          statusCode: 503,
          message: 'ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ในภายหลัง',
          error: 'Service Unavailable',
        });
      }
    } catch (error) {
      // กรณี Redis ล่ม หรือ Error อื่นๆ ให้ยอมให้ผ่านไปก่อน (Fail Open) หรือ Block (Fail Closed) ตามนโยบาย
      // ในที่นี้เลือก Fail Open เพื่อไม่ให้ระบบล่มตาม Redis
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error('Error checking maintenance mode', error);
    }

    return true;
  }
}
