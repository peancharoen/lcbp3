// File: backend/src/modules/ai/services/rag-observability.service.ts
// Change Log:
// - 2026-09-17: เปลี่ยน metrics storage จาก in-memory เป็น Redis hash (rag:metrics)
//   เพื่อให้ค่ารอด backend restart/deploy — counters ยังคง fire-and-forget sync API,
//   getSnapshot()/reset() เป็น async; activeConcurrent/maxConcurrent ยังเป็น
//   per-process gauges ใน memory (ค่าที่ถูกต้องอยู่แล้วเมื่อ process restart)
// - 2026-09-17: align snapshot fields กับ RagAdminMetricsSnapshotDto —
//   staleResultRate {filtered,total}, fallbackRate {fullTextFallbacks,totalQueries}
// - 2026-09-11: T053 — เพิ่ม observability service สำหรับ RAG generation metrics (Feature 254, Phase 5 US3)
//   ครอบคลุม concurrency, rollback, และ partial Qdrant failure metrics
// - 2026-09-12: T074 — เพิ่ม performance metrics: ingestion duration, chunk count,
//   vector latency, stale-result rate, fallback rate, cleanup retry rate (Feature 254, Phase 8)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

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
  /** จำนวน stale results ที่ถูกกรองออก */
  filtered: number;
  /** จำนวน vector results ทั้งหมดที่ถูกตรวจ generation status */
  total: number;
}

/** ตัวนับ metrics สำหรับ full-text fallback rate แบบ in-memory */
interface FallbackRateMetrics {
  /** จำนวนครั้งที่ full-text fallback ถูกเรียก */
  fullTextFallbacks: number;
  /** จำนวน RAG queries ทั้งหมด (denominator) */
  totalQueries: number;
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
 * Metrics เก็บใน Redis hash `rag:metrics` (persist ข้าม backend restart)
 * — record methods เป็น fire-and-forget (sync API, ไม่ block hot path)
 * — activeConcurrent/maxConcurrent เป็น per-process gauges ใน memory
 *   เพราะ concurrency เป็นคุณสมบัติของ process อยู่แล้ว
 * ในอนาคตสามารถเปลี่ยนเป็น Prometheus ได้โดยการเพิ่ม adapter
 */
@Injectable()
export class RagObservabilityService {
  private readonly logger = new Logger(RagObservabilityService.name);
  private readonly startedAt = Date.now();

  /** Redis hash key สำหรับ metrics ทั้งหมด (ไม่มี TTL — persist ข้าม restart) */
  private static readonly METRICS_KEY = 'rag:metrics';

  /** Bucket boundaries (ms) สำหรับ ingestion duration histogram */
  private static readonly INGESTION_DURATION_BUCKETS = [100, 500, 2000];
  /** Bucket boundaries (ms) สำหรับ vector latency histogram */
  private static readonly VECTOR_LATENCY_BUCKETS = [50, 100, 500, 2000];

  /** Per-process concurrency gauges (ค่าใน memory เท่านั้น — restart = 0 คือค่าที่ถูก) */
  private activeConcurrent = 0;
  private maxConcurrent = 0;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /** Increment counter field ใน Redis hash แบบ fire-and-forget */
  private incr(field: string, delta = 1): void {
    this.redis
      .hincrby(RagObservabilityService.METRICS_KEY, field, delta)
      .catch((err: unknown) => {
        this.logger.warn(
          `metrics hincrby ${field} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
  }

  // ─── Swap Metrics ───────────────────────────────────────────────────────

  /** บันทึกว่า swap operation เริ่มต้น (increment active concurrent) */
  public recordSwapStarted(attachmentPublicId: string): void {
    this.incr('swap.started');
    this.activeConcurrent += 1;
    if (this.activeConcurrent > this.maxConcurrent) {
      this.maxConcurrent = this.activeConcurrent;
    }
    this.logger.debug(
      `Swap started for attachment ${attachmentPublicId} — active=${this.activeConcurrent}`
    );
  }

  /** บันทึกว่า swap operation สำเร็จ (decrement active concurrent) */
  public recordSwapCompleted(
    attachmentPublicId: string,
    activeCount: number
  ): void {
    this.incr('swap.completed');
    this.activeConcurrent = Math.max(0, this.activeConcurrent - 1);
    this.logger.debug(
      `Swap completed for attachment ${attachmentPublicId} — activeGenerations=${activeCount}`
    );
  }

  /** บันทึกว่า swap operation rollback (transaction fail) */
  public recordSwapRollback(
    attachmentPublicId: string,
    errorMessage: string
  ): void {
    this.incr('swap.rolledBack');
    this.activeConcurrent = Math.max(0, this.activeConcurrent - 1);
    this.logger.warn(
      `Swap rollback for attachment ${attachmentPublicId}: ${errorMessage}`
    );
  }

  // ─── Qdrant Deletion Metrics ───────────────────────────────────────────

  /** บันทึกว่ามีคำสั่งลบ Qdrant vectors (attempt) */
  public recordQdrantDeletionAttempted(pointCount: number): void {
    this.incr('qdrantDeletion.attempted');
    this.logger.debug(`Qdrant deletion attempted — points=${pointCount}`);
  }

  /** บันทึกว่า Qdrant deletion สำเร็จ */
  public recordQdrantDeletionSucceeded(pointCount: number): void {
    this.incr('qdrantDeletion.succeeded');
    this.logger.debug(`Qdrant deletion succeeded — points=${pointCount}`);
  }

  /** บันทึกว่า Qdrant deletion ล้มเหลวบางส่วน (partial failure) */
  public recordQdrantPartialFailure(
    generationUuid: string,
    errorMessage: string
  ): void {
    this.incr('qdrantDeletion.partialFailures');
    this.logger.warn(
      `Qdrant partial failure for generation ${generationUuid}: ${errorMessage}`
    );
  }

  /** บันทึกว่ามี pending retry record ถูกสร้าง (compensation pattern) */
  public recordPendingRetryCreated(): void {
    this.incr('qdrantDeletion.totalPendingRetries');
  }

  // ─── Cleanup Metrics ───────────────────────────────────────────────────

  /** บันทึกว่า cleanup job เริ่มประมวลผล */
  public recordCleanupProcessed(): void {
    this.incr('cleanup.processed');
  }

  /** บันทึกว่า cleanup job สำเร็จ */
  public recordCleanupSucceeded(): void {
    this.incr('cleanup.succeeded');
  }

  /** บันทึกว่า cleanup job ล้มเหลว */
  public recordCleanupFailed(): void {
    this.incr('cleanup.failed');
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
    this.incr('ingestionDuration.count');
    this.incr('ingestionDuration.sumMs', durationMs);
    for (const boundary of RagObservabilityService.INGESTION_DURATION_BUCKETS) {
      if (durationMs <= boundary) {
        this.incr(`ingestionDuration.buckets.${boundary}`);
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
    this.incr('chunkCount.totalChunks', chunkCount);
    this.incr('chunkCount.ingestions');
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
    this.incr('vectorLatency.count');
    this.incr('vectorLatency.sumMs', latencyMs);
    for (const boundary of RagObservabilityService.VECTOR_LATENCY_BUCKETS) {
      if (latencyMs <= boundary) {
        this.incr(`vectorLatency.buckets.${boundary}`);
      }
    }
    this.logger.debug(`Vector latency for ${operation}: ${latencyMs}ms`);
  }

  // ─── Stale Result Rate Metrics (T074) ─────────────────────────────────

  /** บันทึกว่ามี stale result ถูกกรองออกจากผลลัพธ์ */
  public recordStaleResultFiltered(): void {
    this.incr('staleResultRate.filtered');
    this.logger.debug('Stale result filtered from search results');
  }

  /** บันทึกจำนวน vector results ที่ถูกตรวจ generation status (denominator ของ stale rate) */
  public recordVectorResultsExamined(count: number): void {
    if (count <= 0) return;
    this.incr('staleResultRate.total', count);
  }

  // ─── Fallback Rate Metrics (T074) ────────────────────────────────────

  /** บันทึกว่ามี full-text fallback ถูกเรียก (เมื่อ vector search ไม่เพียงพอ) */
  public recordFallbackInvocation(): void {
    this.incr('fallbackRate.fullTextFallbacks');
    this.logger.warn('Full-text fallback invoked');
  }

  /** บันทึกว่ามี RAG query เกิดขึ้น (denominator ของ fallback rate) */
  public recordRagQuery(): void {
    this.incr('fallbackRate.totalQueries');
  }

  // ─── Cleanup Retry Rate Metrics (T074) ────────────────────────────────

  /** บันทึกว่ามี cleanup retry เกิดขึ้น (compensation pattern) */
  public recordCleanupRetry(): void {
    this.incr('cleanupRetryRate.retries');
    this.logger.debug('Cleanup retry occurred');
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────

  /** คืน snapshot ของ metrics ทั้งหมดสำหรับ /metrics endpoint (อ่านจาก Redis hash) */
  public async getSnapshot(): Promise<RagObservabilitySnapshot> {
    let raw: Record<string, string> = {};
    try {
      raw = await this.redis.hgetall(RagObservabilityService.METRICS_KEY);
    } catch (err: unknown) {
      this.logger.warn(
        `metrics hgetall failed — returning zero snapshot: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const num = (field: string): number => {
      const v = Number(raw[field]);
      return Number.isFinite(v) ? v : 0;
    };
    return {
      swap: {
        started: num('swap.started'),
        completed: num('swap.completed'),
        rolledBack: num('swap.rolledBack'),
        activeConcurrent: this.activeConcurrent,
        maxConcurrent: this.maxConcurrent,
      },
      qdrantDeletion: {
        attempted: num('qdrantDeletion.attempted'),
        succeeded: num('qdrantDeletion.succeeded'),
        partialFailures: num('qdrantDeletion.partialFailures'),
        totalPendingRetries: num('qdrantDeletion.totalPendingRetries'),
      },
      cleanup: {
        processed: num('cleanup.processed'),
        succeeded: num('cleanup.succeeded'),
        failed: num('cleanup.failed'),
      },
      ingestionDuration: {
        count: num('ingestionDuration.count'),
        sumMs: num('ingestionDuration.sumMs'),
        buckets: {
          '100': num('ingestionDuration.buckets.100'),
          '500': num('ingestionDuration.buckets.500'),
          '2000': num('ingestionDuration.buckets.2000'),
        },
      },
      chunkCount: {
        totalChunks: num('chunkCount.totalChunks'),
        ingestions: num('chunkCount.ingestions'),
      },
      vectorLatency: {
        count: num('vectorLatency.count'),
        sumMs: num('vectorLatency.sumMs'),
        buckets: {
          '50': num('vectorLatency.buckets.50'),
          '100': num('vectorLatency.buckets.100'),
          '500': num('vectorLatency.buckets.500'),
          '2000': num('vectorLatency.buckets.2000'),
        },
      },
      staleResultRate: {
        filtered: num('staleResultRate.filtered'),
        total: num('staleResultRate.total'),
      },
      fallbackRate: {
        fullTextFallbacks: num('fallbackRate.fullTextFallbacks'),
        totalQueries: num('fallbackRate.totalQueries'),
      },
      cleanupRetryRate: {
        retries: num('cleanupRetryRate.retries'),
      },
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  /** Reset metrics ทั้งหมด (ลบ Redis hash + reset per-process gauges) */
  public async reset(): Promise<void> {
    try {
      await this.redis.del(RagObservabilityService.METRICS_KEY);
    } catch (err: unknown) {
      this.logger.warn(
        `metrics del failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    this.activeConcurrent = 0;
    this.maxConcurrent = 0;
  }
}
