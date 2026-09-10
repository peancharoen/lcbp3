// File: backend/src/modules/ai/services/rag-observability.service.ts
// Change Log:
// - 2026-09-11: T053 — เพิ่ม observability service สำหรับ RAG generation metrics (Feature 254, Phase 5 US3)
//   ครอบคลุม concurrency, rollback, และ partial Qdrant failure metrics
// - 2026-09-12: T074 — เพิ่ม performance metrics: ingestion duration, chunk count,
//   vector latency, stale-result rate, fallback rate, cleanup retry rate (Feature 254, Phase 8)

import { Injectable, Logger } from '@nestjs/common';

/** ตัวนับ metrics สำหรับ swap operation แบบ in-memory */
interface SwapMetrics {
  started: number;
  completed: number;
  rolledBack: number;
  activeConcurrent: number;
  maxConcurrent: number;
}

/** ตัวนับ metrics สำหรับ Qdrant deletion แบบ in-memory */
interface QdrantDeletionMetrics {
  attempted: number;
  succeeded: number;
  partialFailures: number;
  totalPendingRetries: number;
}

/** ตัวนับ metrics สำหรับ cleanup operation แบบ in-memory */
interface CleanupMetrics {
  processed: number;
  succeeded: number;
  failed: number;
}

/** Histogram buckets สำหรับ ingestion duration (ms) — ตาม ADR-010 performance tracking */
interface DurationHistogram {
  count: number;
  sumMs: number;
  buckets: Record<string, number>;
}

/** ตัวนับ metrics สำหรับ chunk count ต่อ ingestion แบบ in-memory */
interface ChunkCountMetrics {
  totalChunks: number;
  ingestions: number;
}

/** ตัวนับ metrics สำหรับ stale result rate แบบ in-memory */
interface StaleResultRateMetrics {
  filtered: number;
}

/** ตัวนับ metrics สำหรับ full-text fallback rate แบบ in-memory */
interface FallbackRateMetrics {
  invocations: number;
}

/** ตัวนับ metrics สำหรับ cleanup retry rate แบบ in-memory */
interface CleanupRetryRateMetrics {
  retries: number;
}

/** Snapshot ของ metrics ทั้งหมดสำหรับ exposure ไปยัง monitoring */
export interface RagObservabilitySnapshot {
  swap: SwapMetrics;
  qdrantDeletion: QdrantDeletionMetrics;
  cleanup: CleanupMetrics;
  ingestionDuration: DurationHistogram;
  chunkCount: ChunkCountMetrics;
  vectorLatency: DurationHistogram;
  staleResultRate: StaleResultRateMetrics;
  fallbackRate: FallbackRateMetrics;
  cleanupRetryRate: CleanupRetryRateMetrics;
  uptimeMs: number;
}

/**
 * Service สำหรับบันทึกและเปิดเผย RAG generation observability metrics
 * ครอบคลุม:
 * - Concurrency: จำนวน swap operation ที่กำลังทำงานพร้อมกัน
 * - Rollback: จำนวน transaction ที่ rollback
 * - Partial Qdrant failure: จำนวนครั้งที่ Qdrant deletion ล้มเหลวบางส่วน
 * - Ingestion duration: histogram ของเวลาที่ใช้ใน ingestion ต่อ attachment
 * - Chunk count: จำนวน chunk ที่สร้างต่อ ingestion
 * - Vector latency: histogram ของเวลาที่ใช้ใน Qdrant operations
 * - Stale result rate: จำนวน stale results ที่ถูกกรองออก
 * - Fallback rate: จำนวนครั้งที่ full-text fallback ถูกเรียก
 * - Cleanup retry rate: จำนวน cleanup retries
 *
 * Metrics เก็บใน memory (สำหรับ /metrics endpoint และ structured logging)
 * ในอนาคตสามารถเปลี่ยนเป็น Prometheus ได้โดยการเพิ่ม adapter
 */
@Injectable()
export class RagObservabilityService {
  private readonly logger = new Logger(RagObservabilityService.name);
  private readonly startedAt = Date.now();

  /** Bucket boundaries (ms) สำหรับ ingestion duration histogram */
  private static readonly INGESTION_DURATION_BUCKETS = [100, 500, 2000];
  /** Bucket boundaries (ms) สำหรับ vector latency histogram */
  private static readonly VECTOR_LATENCY_BUCKETS = [50, 100, 500, 2000];

  private readonly swapMetrics: SwapMetrics = {
    started: 0,
    completed: 0,
    rolledBack: 0,
    activeConcurrent: 0,
    maxConcurrent: 0,
  };

  private readonly qdrantMetrics: QdrantDeletionMetrics = {
    attempted: 0,
    succeeded: 0,
    partialFailures: 0,
    totalPendingRetries: 0,
  };

  private readonly cleanupMetrics: CleanupMetrics = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  private readonly ingestionDurationMetrics: DurationHistogram = {
    count: 0,
    sumMs: 0,
    buckets: { '100': 0, '500': 0, '2000': 0 },
  };

  private readonly chunkCountMetrics: ChunkCountMetrics = {
    totalChunks: 0,
    ingestions: 0,
  };

  private readonly vectorLatencyMetrics: DurationHistogram = {
    count: 0,
    sumMs: 0,
    buckets: { '50': 0, '100': 0, '500': 0, '2000': 0 },
  };

  private readonly staleResultRateMetrics: StaleResultRateMetrics = {
    filtered: 0,
  };

  private readonly fallbackRateMetrics: FallbackRateMetrics = {
    invocations: 0,
  };

  private readonly cleanupRetryRateMetrics: CleanupRetryRateMetrics = {
    retries: 0,
  };

  // ─── Swap Metrics ───────────────────────────────────────────────────────

  /** บันทึกว่า swap operation เริ่มต้น (increment active concurrent) */
  public recordSwapStarted(attachmentPublicId: string): void {
    this.swapMetrics.started += 1;
    this.swapMetrics.activeConcurrent += 1;
    if (this.swapMetrics.activeConcurrent > this.swapMetrics.maxConcurrent) {
      this.swapMetrics.maxConcurrent = this.swapMetrics.activeConcurrent;
    }
    this.logger.debug(
      `Swap started for attachment ${attachmentPublicId} — active=${this.swapMetrics.activeConcurrent}`
    );
  }

  /** บันทึกว่า swap operation สำเร็จ (decrement active concurrent) */
  public recordSwapCompleted(
    attachmentPublicId: string,
    activeCount: number
  ): void {
    this.swapMetrics.completed += 1;
    this.swapMetrics.activeConcurrent = Math.max(
      0,
      this.swapMetrics.activeConcurrent - 1
    );
    this.logger.debug(
      `Swap completed for attachment ${attachmentPublicId} — activeGenerations=${activeCount}`
    );
  }

  /** บันทึกว่า swap operation rollback (transaction fail) */
  public recordSwapRollback(
    attachmentPublicId: string,
    errorMessage: string
  ): void {
    this.swapMetrics.rolledBack += 1;
    this.swapMetrics.activeConcurrent = Math.max(
      0,
      this.swapMetrics.activeConcurrent - 1
    );
    this.logger.warn(
      `Swap rollback for attachment ${attachmentPublicId}: ${errorMessage}`
    );
  }

  // ─── Qdrant Deletion Metrics ───────────────────────────────────────────

  /** บันทึกว่ามีคำสั่งลบ Qdrant vectors (attempt) */
  public recordQdrantDeletionAttempted(pointCount: number): void {
    this.qdrantMetrics.attempted += 1;
    this.logger.debug(`Qdrant deletion attempted — points=${pointCount}`);
  }

  /** บันทึกว่า Qdrant deletion สำเร็จ */
  public recordQdrantDeletionSucceeded(pointCount: number): void {
    this.qdrantMetrics.succeeded += 1;
    this.logger.debug(`Qdrant deletion succeeded — points=${pointCount}`);
  }

  /** บันทึกว่า Qdrant deletion ล้มเหลวบางส่วน (partial failure) */
  public recordQdrantPartialFailure(
    generationUuid: string,
    errorMessage: string
  ): void {
    this.qdrantMetrics.partialFailures += 1;
    this.logger.warn(
      `Qdrant partial failure for generation ${generationUuid}: ${errorMessage}`
    );
  }

  /** บันทึกว่ามี pending retry record ถูกสร้าง (compensation pattern) */
  public recordPendingRetryCreated(): void {
    this.qdrantMetrics.totalPendingRetries += 1;
  }

  // ─── Cleanup Metrics ───────────────────────────────────────────────────

  /** บันทึกว่า cleanup job เริ่มประมวลผล */
  public recordCleanupProcessed(): void {
    this.cleanupMetrics.processed += 1;
  }

  /** บันทึกว่า cleanup job สำเร็จ */
  public recordCleanupSucceeded(): void {
    this.cleanupMetrics.succeeded += 1;
  }

  /** บันทึกว่า cleanup job ล้มเหลว */
  public recordCleanupFailed(): void {
    this.cleanupMetrics.failed += 1;
  }

  // ─── Ingestion Duration Metrics (T074) ─────────────────────────────────

  /**
   * บันทึก ingestion duration ต่อ attachment (histogram)
   * @param attachmentPublicId public id ของ attachment
   * @param durationMs เวลาที่ใช้ใน ingestion (ms)
   */
  public recordIngestionDuration(
    attachmentPublicId: string,
    durationMs: number
  ): void {
    this.ingestionDurationMetrics.count += 1;
    this.ingestionDurationMetrics.sumMs += durationMs;
    for (const boundary of RagObservabilityService.INGESTION_DURATION_BUCKETS) {
      if (durationMs <= boundary) {
        this.ingestionDurationMetrics.buckets[String(boundary)] += 1;
      }
    }
    this.logger.debug(
      `Ingestion duration for attachment ${attachmentPublicId}: ${durationMs}ms`
    );
  }

  // ─── Chunk Count Metrics (T074) ───────────────────────────────────────

  /**
   * บันทึกจำนวน chunk ที่สร้างใน ingestion หนึ่งครั้ง
   * @param attachmentPublicId public id ของ attachment
   * @param chunkCount จำนวน chunk ที่สร้าง
   */
  public recordChunkCount(
    attachmentPublicId: string,
    chunkCount: number
  ): void {
    this.chunkCountMetrics.totalChunks += chunkCount;
    this.chunkCountMetrics.ingestions += 1;
    this.logger.debug(
      `Chunk count for attachment ${attachmentPublicId}: ${chunkCount}`
    );
  }

  // ─── Vector Latency Metrics (T074) ────────────────────────────────────

  /**
   * บันทึก vector latency สำหรับ Qdrant operations (histogram)
   * @param operation ประเภท operation (upsert, search, delete)
   * @param latencyMs เวลาที่ใช้ (ms)
   */
  public recordVectorLatency(operation: string, latencyMs: number): void {
    this.vectorLatencyMetrics.count += 1;
    this.vectorLatencyMetrics.sumMs += latencyMs;
    for (const boundary of RagObservabilityService.VECTOR_LATENCY_BUCKETS) {
      if (latencyMs <= boundary) {
        this.vectorLatencyMetrics.buckets[String(boundary)] += 1;
      }
    }
    this.logger.debug(`Vector latency for ${operation}: ${latencyMs}ms`);
  }

  // ─── Stale Result Rate Metrics (T074) ─────────────────────────────────

  /** บันทึกว่ามี stale result ถูกกรองออกจากผลลัพธ์ */
  public recordStaleResultFiltered(): void {
    this.staleResultRateMetrics.filtered += 1;
    this.logger.debug('Stale result filtered from search results');
  }

  // ─── Fallback Rate Metrics (T074) ────────────────────────────────────

  /** บันทึกว่ามี full-text fallback ถูกเรียก (เมื่อ vector search ไม่เพียงพอ) */
  public recordFallbackInvocation(): void {
    this.fallbackRateMetrics.invocations += 1;
    this.logger.warn('Full-text fallback invoked');
  }

  // ─── Cleanup Retry Rate Metrics (T074) ────────────────────────────────

  /** บันทึกว่ามี cleanup retry เกิดขึ้น (compensation pattern) */
  public recordCleanupRetry(): void {
    this.cleanupRetryRateMetrics.retries += 1;
    this.logger.debug('Cleanup retry occurred');
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────

  /** คืน snapshot ของ metrics ทั้งหมดสำหรับ /metrics endpoint */
  public getSnapshot(): RagObservabilitySnapshot {
    return {
      swap: { ...this.swapMetrics },
      qdrantDeletion: { ...this.qdrantMetrics },
      cleanup: { ...this.cleanupMetrics },
      ingestionDuration: {
        count: this.ingestionDurationMetrics.count,
        sumMs: this.ingestionDurationMetrics.sumMs,
        buckets: { ...this.ingestionDurationMetrics.buckets },
      },
      chunkCount: { ...this.chunkCountMetrics },
      vectorLatency: {
        count: this.vectorLatencyMetrics.count,
        sumMs: this.vectorLatencyMetrics.sumMs,
        buckets: { ...this.vectorLatencyMetrics.buckets },
      },
      staleResultRate: { ...this.staleResultRateMetrics },
      fallbackRate: { ...this.fallbackRateMetrics },
      cleanupRetryRate: { ...this.cleanupRetryRateMetrics },
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  /** Reset metrics ทั้งหมด (สำหรับ testing) */
  public reset(): void {
    this.swapMetrics.started = 0;
    this.swapMetrics.completed = 0;
    this.swapMetrics.rolledBack = 0;
    this.swapMetrics.activeConcurrent = 0;
    this.swapMetrics.maxConcurrent = 0;
    this.qdrantMetrics.attempted = 0;
    this.qdrantMetrics.succeeded = 0;
    this.qdrantMetrics.partialFailures = 0;
    this.qdrantMetrics.totalPendingRetries = 0;
    this.cleanupMetrics.processed = 0;
    this.cleanupMetrics.succeeded = 0;
    this.cleanupMetrics.failed = 0;
    this.ingestionDurationMetrics.count = 0;
    this.ingestionDurationMetrics.sumMs = 0;
    this.ingestionDurationMetrics.buckets = { '100': 0, '500': 0, '2000': 0 };
    this.chunkCountMetrics.totalChunks = 0;
    this.chunkCountMetrics.ingestions = 0;
    this.vectorLatencyMetrics.count = 0;
    this.vectorLatencyMetrics.sumMs = 0;
    this.vectorLatencyMetrics.buckets = {
      '50': 0,
      '100': 0,
      '500': 0,
      '2000': 0,
    };
    this.staleResultRateMetrics.filtered = 0;
    this.fallbackRateMetrics.invocations = 0;
    this.cleanupRetryRateMetrics.retries = 0;
  }
}
