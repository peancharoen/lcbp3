// File: src/modules/monitoring/controllers/health.controller.ts
// Change Log:
// - 2026-08-20: SEV-013 — แยก /ping (public, no infra details) จาก /health (auth required)

import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator
  ) {}

  /** SEV-013: /ping เป็น public endpoint สำหรับ load balancer — ไม่เปิดเผยข้อมูล infra */
  @Get('ping')
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** SEV-013: /health ต้องมี JWT auth — แสดงรายละเอียด infrastructure */
  @Get('health')
  @UseGuards(JwtAuthGuard)
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
