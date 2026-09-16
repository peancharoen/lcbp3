// File: specs/999-test-plan/scripts/seed-failed-jobs.js
// Change Log:
// - 2026-09-16: สร้าง seed script สำหรับ SC002 round-2 data prep (D8/D9) —
//   เขียน failed BullMQ jobs ลง Redis โดยตรง (job hash + failed zset)
//   ใช้ทดสอบ Engine Control retry/clear-failed โดยไม่ต้องให้ processor ล้มจริง
//
// ใช้งาน (รันใน backend container ที่เข้าถึง redis://cache:6379 ได้):
//   node seed-failed-jobs.js <queueName> <count> [reason] [--prefix <p>]
//   node seed-failed-jobs.js ai-vector-deletion 10000
//   node seed-failed-jobs.js ai-batch 3 "Ollama timeout"
//
// หมายเหตุ: Engine Control อ่าน failed jobs ผ่าน BullMQ getFailed()/getJobs()
// → ต้องเขียน hash `bull:<queue>:<id>` + zset `bull:<queue>:failed` ให้ครบโครงสร้าง

'use strict';

const Redis = require('ioredis');

const QUEUE_NAME = process.argv[2];
const COUNT = parseInt(process.argv[3] || '0', 10);
const REASON = process.argv[4] || 'seeded failure for SC002 test';
const PREFIX_ARG_IDX = process.argv.indexOf('--prefix');
const ID_PREFIX =
  PREFIX_ARG_IDX !== -1 ? process.argv[PREFIX_ARG_IDX + 1] : 'sc002r2';

if (!QUEUE_NAME || !Number.isFinite(COUNT) || COUNT <= 0) {
  console.error(
    'usage: node seed-failed-jobs.js <queueName> <count> [reason] [--prefix <p>]'
  );
  process.exit(1);
}

const redis = new Redis(
  process.env.REDIS_URL ||
    `redis://:${process.env.REDIS_PASSWORD || ''}@${
      process.env.REDIS_HOST || 'cache'
    }:${process.env.REDIS_PORT || '6379'}`,
  {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
  }
);

const KEY_PREFIX = `bull:${QUEUE_NAME}`;
const BATCH_SIZE = 500;

async function main() {
  const now = Date.now();
  let written = 0;

  for (let offset = 0; offset < COUNT; offset += BATCH_SIZE) {
    const batch = Math.min(BATCH_SIZE, COUNT - offset);
    const pipe = redis.pipeline();

    for (let i = 0; i < batch; i++) {
      const n = offset + i;
      const jobId = `${ID_PREFIX}-failed-${n}`;
      const jobKey = `${KEY_PREFIX}:${jobId}`;
      const finishedOn = now - (COUNT - n); // spread timestamps เพื่อให้ order มีความหมาย

      pipe.hset(jobKey, {
        name: 'seeded-failed-job',
        data: JSON.stringify({
          jobType: 'seeded-failed',
          seedIndex: n,
          batchId: `${ID_PREFIX}-batch`,
        }),
        opts: JSON.stringify({ attempts: 3, delay: 0 }),
        attemptsMade: '3',
        processedOn: String(finishedOn - 1000),
        finishedOn: String(finishedOn),
        failedReason: `${REASON} (seed #${n})`,
        stacktrace: JSON.stringify([
          `Error: ${REASON}`,
          `    at seededProcessor (seed-failed-jobs.js:1:1)`,
        ]),
      });
      pipe.zadd(`${KEY_PREFIX}:failed`, String(finishedOn), jobId);
    }

    await pipe.exec();
    written += batch;
    if (written % 5000 === 0 || written === COUNT) {
      console.log(`seeded ${written}/${COUNT} failed jobs → ${QUEUE_NAME}`);
    }
  }

  const failedCount = await redis.zcard(`${KEY_PREFIX}:failed`);
  console.log(`done — ${QUEUE_NAME} failed zset now has ${failedCount} members`);
  await redis.quit();
}

main().catch(async (err) => {
  console.error('seed failed:', err);
  await redis.quit();
  process.exit(1);
});
