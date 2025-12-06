// File: src/modules/monitoring/monitoring.module.ts

import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

// Existing Components
import { HealthController } from './controllers/health.controller';
import { MetricsService } from './services/metrics.service';
import { PerformanceInterceptor } from '../../common/interceptors/performance.interceptor';

// [NEW] Maintenance Mode Components
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Global()
@Module({
  imports: [
    TerminusModule,
    HttpModule,
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [HealthController, MonitoringController],
  providers: [
    MetricsService,
    MonitoringService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    // Metrics Providers
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 5.0],
    }),
  ],
  exports: [MetricsService, MonitoringService, PrometheusModule],
})
export class MonitoringModule {}
