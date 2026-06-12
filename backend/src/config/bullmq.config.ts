// File: src/config/bullmq.config.ts
// Change Log:
// - 2026-05-13: Add BullMQ config registry for reminder and distribution queues.
// - 2026-05-15: เพิ่ม config สำหรับ ai-realtime และ ai-batch ตาม ADR-023A.
// - 2026-06-11: ปรับ aiRealtimeQueue.concurrency ให้รองรับ AI_REALTIME_CONCURRENCY / REALTIME_CONCURRENCY

import { registerAs } from '@nestjs/config';

export default registerAs('bullmq', () => ({
  prefix: process.env.BULLMQ_QUEUE_PREFIX || 'rfa',
  reminderQueue: process.env.BULLMQ_REMINDER_QUEUE || 'rfa-reminders',
  distributionQueue:
    process.env.BULLMQ_DISTRIBUTION_QUEUE || 'rfa-distribution',
  aiRealtimeQueue: {
    name: process.env.BULLMQ_AI_REALTIME_QUEUE || 'ai-realtime',
    concurrency: Number(
      process.env.AI_REALTIME_CONCURRENCY ||
        process.env.REALTIME_CONCURRENCY ||
        '2'
    ),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  },
  aiBatchQueue: {
    name: process.env.BULLMQ_AI_BATCH_QUEUE || 'ai-batch',
    concurrency: 1,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  connection: {
    host: process.env.REDIS_HOST || 'cache',
    port: Number(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
}));
