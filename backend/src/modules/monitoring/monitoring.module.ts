// File: src/modules/monitoring/monitoring.module.ts

import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

// Queue name constants สำหรับ registerQueue ใน MonitoringModule
// Fix: BullmqMetricsService inject 6 queues ผ่าน @InjectQueue() แต่ MonitoringModule
// ไม่ได้ register queue providers ทำให้ NestJS DI หา BullQueue_ai-ingest ไม่เจอ
// ต้องเรียก registerQueue ที่นี่เช่นเดียวกับ AiModule (NestJS BullMQ pattern:
// registerQueue สามารถเรียกซ้ำในหลาย module สำหรับ queue เดียวกัน ได้ เพราะ
// เชื่อมต่อ Redis queue เดียวกันผ่าน forRoot ที่ลงทะเบียนใน app.module.ts)
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_REALTIME,
  QUEUE_AI_BATCH,
  QUEUE_AI_RAG,
} from '../common/constants/queue.constants';
import { QUEUE_NP_DMS_OCR } from '../ai/processors/np-dms-ocr-processor';
import { QUEUE_NP_DMS_AI } from '../ai/processors/np-dms-ai.processor';

// Existing Components
import { HealthController } from './controllers/health.controller';
import { MetricsService } from './services/metrics.service';
import { PerformanceInterceptor } from '../../common/interceptors/performance.interceptor';

// [NEW] Maintenance Mode Components
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

// [NEW] BullMQ Metrics
import {
  BullmqMetricsService,
  bullmqMetricProviders,
} from './services/bullmq-metrics.service';

@Global()
@Module({
  imports: [
    TerminusModule,
    HttpModule,
    // Fix: Register BullMQ queues ที่ BullmqMetricsService inject ผ่าน @InjectQueue()
    // หากไม่ register ณ ที่นี่ NestJS จะหา queue provider (BullQueue_ai-ingest ฯลฯ) ไม่เจอ
    BullModule.registerQueue(
      { name: QUEUE_AI_INGEST },
      { name: QUEUE_AI_REALTIME },
      { name: QUEUE_AI_BATCH },
      { name: QUEUE_AI_RAG },
      { name: QUEUE_NP_DMS_OCR },
      { name: QUEUE_NP_DMS_AI }
    ),
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
    BullmqMetricsService,
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
    // BullMQ Queue Metrics
    ...bullmqMetricProviders,
  ],
  exports: [MetricsService, MonitoringService, PrometheusModule],
})
export class MonitoringModule {}
