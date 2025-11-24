// File: src/modules/monitoring/monitoring.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SetMaintenanceDto } from './dto/set-maintenance.dto';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly MAINTENANCE_KEY = 'system:maintenance_mode';

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * ตรวจสอบสถานะปัจจุบัน
   */
  async getMaintenanceStatus() {
    const status = await this.redis.get(this.MAINTENANCE_KEY);
    return {
      isEnabled: status === 'true',
      message:
        status === 'true' ? 'System is under maintenance' : 'System is normal',
    };
  }

  /**
   * ตั้งค่า Maintenance Mode
   */
  async setMaintenanceMode(dto: SetMaintenanceDto) {
    if (dto.enabled) {
      await this.redis.set(this.MAINTENANCE_KEY, 'true');
      // เก็บเหตุผลไว้ใน Key อื่นก็ได้ถ้าต้องการ แต่เบื้องต้น Guard เช็คแค่ Key นี้
      this.logger.warn(
        `⚠️ SYSTEM ENTERED MAINTENANCE MODE: ${dto.reason || 'No reason provided'}`,
      );
    } else {
      await this.redis.del(this.MAINTENANCE_KEY);
      this.logger.log('✅ System exited maintenance mode');
    }

    return this.getMaintenanceStatus();
  }
}
