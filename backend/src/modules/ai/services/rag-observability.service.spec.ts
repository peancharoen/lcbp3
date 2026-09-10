// File: backend/src/modules/ai/services/rag-observability.service.spec.ts
// Change Log:
// - 2026-09-11: T053 — เพิ่ม unit tests สำหรับ RagObservabilityService (Feature 254, Phase 5 US3)
// - 2026-09-12: T074 — เพิ่ม tests สำหรับ performance metrics (ingestion duration, chunk count,
//   vector latency, stale-result rate, fallback rate, cleanup retry rate) (Feature 254, Phase 8)

import { Test, TestingModule } from '@nestjs/testing';
import { RagObservabilityService } from './rag-observability.service';

describe('RagObservabilityService', () => {
  let service: RagObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagObservabilityService],
    }).compile();
    service = module.get<RagObservabilityService>(RagObservabilityService);
  });

  // ─── Swap Concurrency Metrics ───────────────────────────────────────────

  it('ควรนับ activeConcurrent เมื่อ swap เริ่มต้น', () => {
    service.recordSwapStarted('att-1');
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.started).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(1);
  });

  it('ควรลด activeConcurrent เมื่อ swap สำเร็จ', () => {
    service.recordSwapStarted('att-1');
    service.recordSwapCompleted('att-1', 1);
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.completed).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  it('ควร track maxConcurrent สูงสุดเมื่อมี swap หลายตัวพร้อมกัน', () => {
    service.recordSwapStarted('att-1');
    service.recordSwapStarted('att-2');
    service.recordSwapStarted('att-3');
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.activeConcurrent).toBe(3);
    expect(snapshot.swap.maxConcurrent).toBe(3);
    // ปิดหนึ่งตัว — maxConcurrent ยังคงเดิม
    service.recordSwapCompleted('att-1', 1);
    const snapshot2 = service.getSnapshot();
    expect(snapshot2.swap.activeConcurrent).toBe(2);
    expect(snapshot2.swap.maxConcurrent).toBe(3);
  });

  it('ไม่ควรให้ activeConcurrent ติดลบ', () => {
    service.recordSwapCompleted('att-1', 1);
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  // ─── Rollback Metrics ──────────────────────────────────────────────────

  it('ควรนับ rollback เมื่อ swap transaction fail', () => {
    service.recordSwapStarted('att-1');
    service.recordSwapRollback('att-1', 'DB connection lost');
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.rolledBack).toBe(1);
    expect(snapshot.swap.activeConcurrent).toBe(0);
  });

  // ─── Qdrant Partial Failure Metrics ─────────────────────────────────────

  it('ควรนับ partialFailures เมื่อ Qdrant deletion ล้มเหลวบางส่วน', () => {
    service.recordQdrantPartialFailure('gen-1', 'Qdrant timeout');
    service.recordQdrantPartialFailure('gen-2', 'Qdrant connection refused');
    const snapshot = service.getSnapshot();
    expect(snapshot.qdrantDeletion.partialFailures).toBe(2);
  });

  it('ควรนับ attempted และ succeeded สำหรับ Qdrant deletion', () => {
    service.recordQdrantDeletionAttempted(10);
    service.recordQdrantDeletionSucceeded(10);
    const snapshot = service.getSnapshot();
    expect(snapshot.qdrantDeletion.attempted).toBe(1);
    expect(snapshot.qdrantDeletion.succeeded).toBe(1);
  });

  it('ควรนับ totalPendingRetries เมื่อ pending retry record ถูกสร้าง', () => {
    service.recordPendingRetryCreated();
    service.recordPendingRetryCreated();
    const snapshot = service.getSnapshot();
    expect(snapshot.qdrantDeletion.totalPendingRetries).toBe(2);
  });

  // ─── Cleanup Metrics ───────────────────────────────────────────────────

  it('ควรนับ processed, succeeded, failed สำหรับ cleanup operations', () => {
    service.recordCleanupProcessed();
    service.recordCleanupProcessed();
    service.recordCleanupSucceeded();
    service.recordCleanupFailed();
    const snapshot = service.getSnapshot();
    expect(snapshot.cleanup.processed).toBe(2);
    expect(snapshot.cleanup.succeeded).toBe(1);
    expect(snapshot.cleanup.failed).toBe(1);
  });

  // ─── Snapshot & Reset ──────────────────────────────────────────────────

  it('ควรคืน uptimeMs > 0 ใน snapshot', () => {
    const snapshot = service.getSnapshot();
    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reset() ควรเคลียร์ metrics ทั้งหมด', () => {
    service.recordSwapStarted('att-1');
    service.recordQdrantPartialFailure('gen-1', 'err');
    service.recordCleanupProcessed();
    service.reset();
    const snapshot = service.getSnapshot();
    expect(snapshot.swap.started).toBe(0);
    expect(snapshot.swap.activeConcurrent).toBe(0);
    expect(snapshot.qdrantDeletion.partialFailures).toBe(0);
    expect(snapshot.cleanup.processed).toBe(0);
  });

  it('snapshot ควรเป็น deep copy (ไม่แชร์ reference)', () => {
    service.recordSwapStarted('att-1');
    const snapshot1 = service.getSnapshot();
    service.recordSwapStarted('att-2');
    const snapshot2 = service.getSnapshot();
    expect(snapshot1.swap.started).toBe(1);
    expect(snapshot2.swap.started).toBe(2);
  });

  // ─── Ingestion Duration Metrics (T074) ─────────────────────────────────

  it('ควรบันทึก ingestion duration ต่อ attachment (histogram buckets)', () => {
    service.recordIngestionDuration('att-1', 50);
    service.recordIngestionDuration('att-2', 150);
    service.recordIngestionDuration('att-3', 1500);
    const snapshot = service.getSnapshot();
    expect(snapshot.ingestionDuration.count).toBe(3);
    expect(snapshot.ingestionDuration.sumMs).toBe(1700);
    // bucket: <=100ms, <=500ms, <=2000ms, >2000ms
    expect(snapshot.ingestionDuration.buckets['100']).toBe(1);
    expect(snapshot.ingestionDuration.buckets['500']).toBe(2);
    expect(snapshot.ingestionDuration.buckets['2000']).toBe(3);
  });

  // ─── Chunk Count Metrics (T074) ────────────────────────────────────────

  it('ควรนับ chunkCount รวมและจำนวน ingestion ต่อครั้ง', () => {
    service.recordChunkCount('att-1', 5);
    service.recordChunkCount('att-2', 10);
    const snapshot = service.getSnapshot();
    expect(snapshot.chunkCount.totalChunks).toBe(15);
    expect(snapshot.chunkCount.ingestions).toBe(2);
  });

  // ─── Vector Latency Metrics (T074) ────────────────────────────────────

  it('ควรบันทึก vectorLatency สำหรับ Qdrant operations (histogram)', () => {
    service.recordVectorLatency('upsert', 30);
    service.recordVectorLatency('upsert', 80);
    service.recordVectorLatency('search', 200);
    const snapshot = service.getSnapshot();
    expect(snapshot.vectorLatency.count).toBe(3);
    expect(snapshot.vectorLatency.sumMs).toBe(310);
    expect(snapshot.vectorLatency.buckets['100']).toBe(2);
    expect(snapshot.vectorLatency.buckets['500']).toBe(3);
  });

  // ─── Stale Result Rate Metrics (T074) ─────────────────────────────────

  it('ควรนับ staleResultRate เมื่อ stale results ถูกกรองออก', () => {
    service.recordStaleResultFiltered();
    service.recordStaleResultFiltered();
    service.recordStaleResultFiltered();
    const snapshot = service.getSnapshot();
    expect(snapshot.staleResultRate.filtered).toBe(3);
  });

  // ─── Fallback Rate Metrics (T074) ─────────────────────────────────────

  it('ควรนับ fallbackRate เมื่อ full-text fallback ถูกเรียก', () => {
    service.recordFallbackInvocation();
    const snapshot = service.getSnapshot();
    expect(snapshot.fallbackRate.invocations).toBe(1);
  });

  // ─── Cleanup Retry Rate Metrics (T074) ───────────────────────────────

  it('ควรนับ cleanupRetryRate เมื่อ cleanup retry เกิดขึ้น', () => {
    service.recordCleanupRetry();
    service.recordCleanupRetry();
    const snapshot = service.getSnapshot();
    expect(snapshot.cleanupRetryRate.retries).toBe(2);
  });

  // ─── Reset สำหรับ metrics ใหม่ (T074) ──────────────────────────────────

  it('reset() ควรเคลียร์ performance metrics ทั้งหมด (T074)', () => {
    service.recordIngestionDuration('att-1', 100);
    service.recordChunkCount('att-1', 3);
    service.recordVectorLatency('upsert', 50);
    service.recordStaleResultFiltered();
    service.recordFallbackInvocation();
    service.recordCleanupRetry();
    service.reset();
    const snapshot = service.getSnapshot();
    expect(snapshot.ingestionDuration.count).toBe(0);
    expect(snapshot.ingestionDuration.sumMs).toBe(0);
    expect(snapshot.chunkCount.totalChunks).toBe(0);
    expect(snapshot.chunkCount.ingestions).toBe(0);
    expect(snapshot.vectorLatency.count).toBe(0);
    expect(snapshot.vectorLatency.sumMs).toBe(0);
    expect(snapshot.staleResultRate.filtered).toBe(0);
    expect(snapshot.fallbackRate.invocations).toBe(0);
    expect(snapshot.cleanupRetryRate.retries).toBe(0);
  });
});
