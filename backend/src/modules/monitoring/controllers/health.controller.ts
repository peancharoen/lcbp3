// File: src/modules/monitoring/controllers/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator
  ) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      // 1. ตรวจสอบการเชื่อมต่อ Database (MariaDB)
      () => this.db.pingCheck('database'),

      // 2. ตรวจสอบ Memory Heap (ไม่ควรเกิน 1GB สำหรับ Container นี้ - ปรับค่าตามจริง)
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),

      // 3. ตรวจสอบพื้นที่ Disk สำหรับ DMS Data (Threshold 90%)
      // path '/' อาจต้องเปลี่ยนเป็น '/share/dms-data' ตาม Environment จริง
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
