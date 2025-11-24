// File: src/modules/monitoring/monitoring.module.ts

import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { APP_INTERCEPTOR } from '@nestjs/core';

// Existing Components
import { HealthController } from './controllers/health.controller';
import { MetricsService } from './services/metrics.service';
import { PerformanceInterceptor } from '../../common/interceptors/performance.interceptor';

// [NEW] Maintenance Mode Components
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Global() // Module นี้เป็น Global (ดีแล้วครับ)
@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [
    HealthController, // ✅ ของเดิม: /health
    MonitoringController, // ✅ ของใหม่: /monitoring/maintenance
  ],
  providers: [
    MetricsService, // ✅ ของเดิม
    MonitoringService, // ✅ ของใหม่ (Logic เปิด/ปิด Maintenance)
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor, // ✅ ของเดิม (จับเวลา Response Time)
    },
  ],
  exports: [MetricsService, MonitoringService],
})
export class MonitoringModule {}
