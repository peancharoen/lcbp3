// File: src/modules/monitoring/monitoring.module.ts
import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './controllers/health.controller';
import { MetricsService } from './services/metrics.service';
import { PerformanceInterceptor } from '../../common/interceptors/performance.interceptor';

@Global() // ทำให้ Module นี้ใช้งานได้ทั่วทั้ง App โดยไม่ต้อง Import ซ้ำ
@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR, // Register Global Interceptor
      useClass: PerformanceInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MonitoringModule {}
