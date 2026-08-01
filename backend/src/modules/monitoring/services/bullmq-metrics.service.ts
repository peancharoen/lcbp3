// File: src/modules/monitoring/services/bullmq-metrics.service.ts
// Change Log:
// - 2026-08-01: Initial creation - BullMQ queue metrics for Prometheus

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { InjectMetric, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_REALTIME,
  QUEUE_AI_BATCH,
  QUEUE_AI_RAG,
} from '../../common/constants/queue.constants';
import { QUEUE_NP_DMS_OCR } from '../../ai/processors/np-dms-ocr-processor';
import { QUEUE_NP_DMS_AI } from '../../ai/processors/np-dms-ai.processor';

/**
 * บริการเก็บ BullMQ queue metrics สำหรับ Prometheus
 * อัปเดตทุก 30 วินาที — แสดงจำนวนงานในแต่ละ state (waiting/active/completed/failed/delayed)
 */
@Injectable()
export class BullmqMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullmqMetricsService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    @InjectQueue(QUEUE_AI_INGEST) private readonly ingestQueue: Queue,
    @InjectQueue(QUEUE_AI_REALTIME) private readonly realtimeQueue: Queue,
    @InjectQueue(QUEUE_AI_BATCH) private readonly batchQueue: Queue,
    @InjectQueue(QUEUE_AI_RAG) private readonly ragQueue: Queue,
    @InjectQueue(QUEUE_NP_DMS_OCR) private readonly ocrQueue: Queue,
    @InjectQueue(QUEUE_NP_DMS_AI) private readonly aiQueue: Queue,
    @InjectMetric('bullmq_jobs_waiting')
    private readonly jobsWaiting: Gauge<string>,
    @InjectMetric('bullmq_jobs_active')
    private readonly jobsActive: Gauge<string>,
    @InjectMetric('bullmq_jobs_completed')
    private readonly jobsCompleted: Gauge<string>,
    @InjectMetric('bullmq_jobs_failed')
    private readonly jobsFailed: Gauge<string>,
    @InjectMetric('bullmq_jobs_delayed')
    private readonly jobsDelayed: Gauge<string>,
    @InjectMetric('bullmq_jobs_paused')
    private readonly jobsPaused: Gauge<string>
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('BullMQ metrics collector started (interval=30s)');
    this.interval = setInterval(() => {
      void this.collectMetrics();
    }, 30_000);
    await this.collectMetrics();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async collectMetrics(): Promise<void> {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: QUEUE_AI_INGEST, queue: this.ingestQueue },
      { name: QUEUE_AI_REALTIME, queue: this.realtimeQueue },
      { name: QUEUE_AI_BATCH, queue: this.batchQueue },
      { name: QUEUE_AI_RAG, queue: this.ragQueue },
      { name: QUEUE_NP_DMS_OCR, queue: this.ocrQueue },
      { name: QUEUE_NP_DMS_AI, queue: this.aiQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused'
        );
        this.jobsWaiting.set({ queue: name }, counts.waiting);
        this.jobsActive.set({ queue: name }, counts.active);
        this.jobsCompleted.set({ queue: name }, counts.completed);
        this.jobsFailed.set({ queue: name }, counts.failed);
        this.jobsDelayed.set({ queue: name }, counts.delayed);
        this.jobsPaused.set({ queue: name }, counts.paused);
      } catch (error) {
        this.logger.warn(
          `Failed to collect metrics for queue "${name}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }
}

/**
 * Prometheus gauge providers สำหรับ BullMQ queue metrics
 */
export const bullmqMetricProviders = [
  makeGaugeProvider({
    name: 'bullmq_jobs_waiting',
    help: 'Number of waiting jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: 'bullmq_jobs_active',
    help: 'Number of active jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: 'bullmq_jobs_completed',
    help: 'Number of completed jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: 'bullmq_jobs_failed',
    help: 'Number of failed jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: 'bullmq_jobs_delayed',
    help: 'Number of delayed jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: 'bullmq_jobs_paused',
    help: 'Number of paused jobs in BullMQ queue',
    labelNames: ['queue'],
  }),
];
