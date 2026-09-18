// File: backend/src/modules/ai/services/rag-observability.service.spec.ts
// Change Log:
// - 2026-09-17: อัปเดต spec ให้ mock Redis (DEFAULT_IORedis token) — service เปลี่ยน
//   เป็น Redis-backed counters; getSnapshot()/reset() เป็น async
// - 2026-09-11: T053 — เพิ่ม unit tests สำหรับ RagObservabilityService (Feature 254, Phase 5 US3)
// - 2026-09-12: T074 — เพิ่ม tests สำหรับ performance metrics (ingestion duration, chunk count,
//   vector latency, stale-result rate, fallback rate, cleanup retry rate) (Feature 254, Phase 8)

import { Test, TestingModule } from '@nestjs/testing';
import { RagObservabilityService } from './rag-observability.service';

/** Token เดียวกับที่ @InjectRedis() ใช้ใน module (pattern เดียวกับ ai-rag.service.spec.ts) */
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/** Mock Redis ที่เก็บ hash ใน memory — hincrby/del ทำงาน synchronous บน store */
function createMockRedis() {
  const store: Record<string, number> = {};
  return {
    store,
    hincrby: jest.fn((_key: string, field: string, delta: number) => {
      store[field] = (store[field] ?? 0) + delta;
      return Promise.resolve(store[field]);
    }),
    hgetall: jest.fn((_key: string) =>
      Promise.resolve(
        Object.fromEntries(
          Object.entries(store).map(([k, v]) => [k, String(v)])
        )
      )
    ),
    del: jest.fn((_key: string) => {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
      return Promise.resolve(1);
    }),
  };
}

describe('RagObservabilityService', () => {
  let service: RagObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagObservabilityService,
        { provide: DEFAULT_REDIS_TOKEN, useValue: createMockRedis() },
      ],
    }).compile();
    service = module.get<RagObservabilityService>(RagObservabilityService);
  });

  // ─── Swap Concurrency Metrics ───────────────────────────────────────────

  it('ควรนับ activeConcurrent เมื่อ swap เริ่มต้น', async () => {
    service.recordSwapStarted('att-1');
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.started).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(1);
  });

  it('ควรลด activeConcurrent เมื่อ swap สำเร็จ', async () => {
    service.recordSwapStarted('att-1');
    service.recordSwapCompleted('att-1', 1);
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.completed).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  it('ควร track maxConcurrent สูงสุดเมื่อมี swap หลายตัวพร้อมกัน', async () => {
    service.recordSwapStarted('att-1');
    service.recordSwapStarted('att-2');
    service.recordSwapStarted('att-3');
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.activeConcurrent).toBe(3);
    expect(snapshot.swap.maxConcurrent).toBe(3);
    // ปิดหนึ่งตัว — maxConcurrent ยังคงเดิม
    service.recordSwapCompleted('att-1', 1);
    const snapshot2 = await service.getSnapshot();
    expect(snapshot2.swap.activeConcurrent).toBe(2);
    expect(snapshot2.swap.maxConcurrent).toBe(3);
  });

  it('ไม่ควรให้ activeConcurrent ติดลบ', async () => {
    service.recordSwapCompleted('att-1', 1);
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  // ─── Rollback Metrics ──────────────────────────────────────────────────

  it('ควรนับ rollback เมื่อ swap transaction fail', async () => {
    service.recordSwapStarted('att-1');
    service.recordSwapRollback('att-1', 'DB connection lost');
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.rolledBack).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  // ─── Qdrant Partial Failure Metrics ─────────────────────────────────────

  it('ควรนับ partialFailures เมื่อ Qdrant deletion ล้มเหลวบางส่วน', async () => {
    service.recordQdrantPartialFailure('gen-1', 'Qdrant timeout');
    service.recordQdrantPartialFailure('gen-2', 'Qdrant connection refused');
    const snapshot = await service.getSnapshot();
    expect(snapshot.qdrantDeletion.partialFailures).toBe(2);
  });

  it('ควรนับ attempted และ succeeded สำหรับ Qdrant deletion', async () => {
    service.recordQdrantDeletionAttempted(10);
    service.recordQdrantDeletionSucceeded(10);
    const snapshot = await service.getSnapshot();
    expect(snapshot.qdrantDeletion.attempted).toBe(1);
    expect(snapshot.qdrantDeletion.succeeded).toBe(1);
  });

  it('ควรนับ totalPendingRetries เมื่อ pending retry record ถูกสร้าง', async () => {
    service.recordPendingRetryCreated();
    service.recordPendingRetryCreated();
    const snapshot = await service.getSnapshot();
    expect(snapshot.qdrantDeletion.totalPendingRetries).toBe(2);
  });

  // ─── Cleanup Metrics ───────────────────────────────────────────────────

  it('ควรนับ processed, succeeded, failed สำหรับ cleanup operations', async () => {
    service.recordCleanupProcessed();
    service.recordCleanupProcessed();
    service.recordCleanupSucceeded();
    service.recordCleanupFailed();
    const snapshot = await service.getSnapshot();
    expect(snapshot.cleanup.processed).toBe(2);
    expect(snapshot.cleanup.succeeded).toBe(1);
    expect(snapshot.cleanup.failed).toBe(1);
  });

  // ─── Snapshot & Reset ──────────────────────────────────────────────────

  it('ควรคืน uptimeMs > 0 ใน snapshot', async () => {
    const snapshot = await service.getSnapshot();
    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reset() ควรเคลียร์ metrics ทั้งหมด', async () => {
    service.recordSwapStarted('att-1');
    service.recordQdrantPartialFailure('gen-1', 'err');
    service.recordCleanupProcessed();
    await service.reset();
    const snapshot = await service.getSnapshot();
    expect(snapshot.swap.started).toBe(0);
    expect(snapshot.swap.activeConcurrent).toBe(0);
    expect(snapshot.qdrantDeletion.partialFailures).toBe(0);
    expect(snapshot.cleanup.processed).toBe(0);
  });

  it('snapshot ควรสะท้อนค่าล่าสุดจาก Redis (ไม่แชร์ reference)', async () => {
    service.recordSwapStarted('att-1');
    const snapshot1 = await service.getSnapshot();
    service.recordSwapStarted('att-2');
    const snapshot2 = await service.getSnapshot();
    expect(snapshot1.swap.started).toBe(1);
    expect(snapshot2.swap.started).toBe(2);
  });

  // ─── Ingestion Duration Metrics (T074) ─────────────────────────────────

  it('ควรบันทึก ingestion duration ต่อ attachment (histogram buckets)', async () => {
    service.recordIngestionDuration('att-1', 50);
    service.recordIngestionDuration('att-2', 150);
    service.recordIngestionDuration('att-3', 1500);
    const snapshot = await service.getSnapshot();
    expect(snapshot.ingestionDuration.count).toBe(3);
    expect(snapshot.ingestionDuration.sumMs).toBe(1700);
    // bucket: <=100ms, <=500ms, <=2000ms, >2000ms
    expect(snapshot.ingestionDuration.buckets['100']).toBe(1);
    expect(snapshot.ingestionDuration.buckets['500']).toBe(2);
    expect(snapshot.ingestionDuration.buckets['2000']).toBe(3);
  });

  // ─── Chunk Count Metrics (T074) ────────────────────────────────────────

  it('ควรนับ chunkCount รวมและจำนวน ingestion ต่อครั้ง', async () => {
    service.recordChunkCount('att-1', 5);
    service.recordChunkCount('att-2', 10);
    const snapshot = await service.getSnapshot();
    expect(snapshot.chunkCount.totalChunks).toBe(15);
    expect(snapshot.chunkCount.ingestions).toBe(2);
  });

  // ─── Vector Latency Metrics (T074) ────────────────────────────────────

  it('ควรบันทึก vectorLatency สำหรับ Qdrant operations (histogram)', async () => {
    service.recordVectorLatency('upsert', 30);
    service.recordVectorLatency('upsert', 80);
    service.recordVectorLatency('search', 200);
    const snapshot = await service.getSnapshot();
    expect(snapshot.vectorLatency.count).toBe(3);
    expect(snapshot.vectorLatency.sumMs).toBe(310);
    expect(snapshot.vectorLatency.buckets['100']).toBe(2);
    expect(snapshot.vectorLatency.buckets['500']).toBe(3);
  });

  // ─── Stale Result Rate Metrics (T074) ─────────────────────────────────

  it('ควรนับ staleResultRate เมื่อ stale results ถูกกรองออก', async () => {
    service.recordVectorResultsExamined(10);
    service.recordStaleResultFiltered();
    service.recordStaleResultFiltered();
    service.recordStaleResultFiltered();
    const snapshot = await service.getSnapshot();
    expect(snapshot.staleResultRate.filtered).toBe(3);
    expect(snapshot.staleResultRate.total).toBe(10);
  });

  // ─── Fallback Rate Metrics (T074) ─────────────────────────────────────

  it('ควรนับ fallbackRate เมื่อ full-text fallback ถูกเรียก', async () => {
    service.recordRagQuery();
    service.recordRagQuery();
    service.recordFallbackInvocation();
    const snapshot = await service.getSnapshot();
    expect(snapshot.fallbackRate.fullTextFallbacks).toBe(1);
    expect(snapshot.fallbackRate.totalQueries).toBe(2);
  });

  // ─── Cleanup Retry Rate Metrics (T074) ───────────────────────────────

  it('ควรนับ cleanupRetryRate เมื่อ cleanup retry เกิดขึ้น', async () => {
    service.recordCleanupRetry();
    service.recordCleanupRetry();
    const snapshot = await service.getSnapshot();
    expect(snapshot.cleanupRetryRate.retries).toBe(2);
  });

  // ─── Reset สำหรับ metrics ใหม่ (T074) ──────────────────────────────────

  it('reset() ควรเคลียร์ performance metrics ทั้งหมด (T074)', async () => {
    service.recordIngestionDuration('att-1', 100);
    service.recordChunkCount('att-1', 3);
    service.recordVectorLatency('upsert', 50);
    service.recordStaleResultFiltered();
    service.recordFallbackInvocation();
    service.recordCleanupRetry();
    await service.reset();
    const snapshot = await service.getSnapshot();
    expect(snapshot.ingestionDuration.count).toBe(0);
    expect(snapshot.ingestionDuration.sumMs).toBe(0);
    expect(snapshot.chunkCount.totalChunks).toBe(0);
    expect(snapshot.chunkCount.ingestions).toBe(0);
    expect(snapshot.vectorLatency.count).toBe(0);
    expect(snapshot.vectorLatency.sumMs).toBe(0);
    expect(snapshot.staleResultRate.filtered).toBe(0);
    expect(snapshot.staleResultRate.total).toBe(0);
    expect(snapshot.fallbackRate.fullTextFallbacks).toBe(0);
    expect(snapshot.fallbackRate.totalQueries).toBe(0);
    expect(snapshot.cleanupRetryRate.retries).toBe(0);
  });

  // ─── Redis failure tolerance ────────────────────────────────────────────

  it('getSnapshot คืน zero snapshot เมื่อ Redis ล้มเหลว (ไม่ throw)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagObservabilityService,
        {
          provide: DEFAULT_REDIS_TOKEN,
          useValue: {
            hincrby: jest.fn().mockResolvedValue(1),
            hgetall: jest.fn().mockRejectedValue(new Error('Redis down')),
            del: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();
    const svc = module.get<RagObservabilityService>(RagObservabilityService);

    const snapshot = await svc.getSnapshot();

    expect(snapshot.swap.started).toBe(0);
    expect(snapshot.fallbackRate.totalQueries).toBe(0);
  });
});
