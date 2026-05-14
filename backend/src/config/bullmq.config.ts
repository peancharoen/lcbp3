// File: src/config/bullmq.config.ts
// Change Log:
// - 2026-05-13: Add BullMQ config registry for reminder and distribution queues.

import { registerAs } from '@nestjs/config';

export default registerAs('bullmq', () => ({
  prefix: process.env.BULLMQ_QUEUE_PREFIX || 'rfa',
  reminderQueue: process.env.BULLMQ_REMINDER_QUEUE || 'rfa-reminders',
  distributionQueue:
    process.env.BULLMQ_DISTRIBUTION_QUEUE || 'rfa-distribution',
  connection: {
    host: process.env.REDIS_HOST || 'cache',
    port: Number(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
}));
