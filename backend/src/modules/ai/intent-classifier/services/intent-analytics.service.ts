// File: src/modules/ai/intent-classifier/services/intent-analytics.service.ts
// Change Log
// - 2026-05-19: สร้าง AnalyticsService สำหรับสรุปสถิติ Intent Classification (T034, US3).

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAuditLog, AiAuditStatus } from '../../entities/ai-audit-log.entity';

/** สถิติแยกตาม method (pattern / llm_fallback / etc.) */
export interface MethodStats {
  method: string;
  count: number;
  avgConfidence: number;
  avgLatencyMs: number;
}

/** สถิติแยกตาม intent code */
export interface IntentStats {
  intentCode: string;
  count: number;
  avgConfidence: number;
  patternHits: number;
  llmHits: number;
}

/** คำแนะนำ Recalibration — intent ที่ควรเพิ่ม pattern */
export interface RecalibrationRecommendation {
  intentCode: string;
  llmCallCount: number;
  avgConfidence: number;
  /** ยิ่งสูง = ควรเพิ่ม pattern มากที่สุด */
  priority: number;
}

/** ผลลัพธ์สรุปรวม Analytics */
export interface ClassificationAnalytics {
  /** จำนวน request ทั้งหมดในช่วง */
  totalRequests: number;
  /** จำนวน request สำเร็จ */
  successCount: number;
  /** จำนวน request ล้มเหลว */
  failedCount: number;
  /** อัตราการ hit ด้วย pattern (ไม่ต้องเรียก LLM) */
  patternHitRate: number;
  /** ค่าเฉลี่ย confidence ทั้งหมด */
  avgConfidence: number;
  /** ค่าเฉลี่ย latency (ms) */
  avgLatencyMs: number;
  /** สถิติแยกตาม method */
  byMethod: MethodStats[];
  /** สถิติแยกตาม intent */
  byIntent: IntentStats[];
  /** คำแนะนำ intent ที่ควรเพิ่ม pattern */
  recalibration: RecalibrationRecommendation[];
}

/**
 * Service สำหรับ Analytics ของ Intent Classification
 * Query จาก ai_audit_logs ที่ aiModel = 'intent-classifier'
 */
@Injectable()
export class IntentAnalyticsService {
  private readonly logger = new Logger(IntentAnalyticsService.name);

  constructor(
    @InjectRepository(AiAuditLog)
    private readonly auditRepo: Repository<AiAuditLog>
  ) {}

  /**
   * ดึงสถิติ Classification ในช่วงเวลาที่กำหนด
   * @param fromDate เริ่มต้น (default: 30 วันก่อน)
   * @param toDate สิ้นสุด (default: ปัจจุบัน)
   */
  async getAnalytics(
    fromDate?: Date,
    toDate?: Date
  ): Promise<ClassificationAnalytics> {
    const from = fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ?? new Date();

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.aiModel = :model', { model: 'intent-classifier' })
      .andWhere('a.createdAt BETWEEN :from AND :to', { from, to });

    // ดึง raw records เพื่อคำนวณ
    const logs = await qb.getMany();

    if (logs.length === 0) {
      return this.emptyAnalytics();
    }

    const totalRequests = logs.length;
    const successLogs = logs.filter((l) => l.status === AiAuditStatus.SUCCESS);
    const failedLogs = logs.filter((l) => l.status !== AiAuditStatus.SUCCESS);

    // แยก method จาก aiSuggestionJson
    const withMethod = logs.map((l) => ({
      ...l,
      method: this.extractMethod(l),
      intentCode: this.extractIntentCode(l),
    }));

    const patternHits = withMethod.filter((l) => l.method === 'pattern').length;
    const patternHitRate = totalRequests > 0 ? patternHits / totalRequests : 0;

    const avgConfidence = this.avg(
      logs.map((l) => Number(l.confidenceScore ?? 0))
    );
    const avgLatencyMs = this.avg(logs.map((l) => l.processingTimeMs ?? 0));

    const byMethod = this.groupByMethod(withMethod);
    const byIntent = this.groupByIntent(withMethod);
    const recalibration = this.buildRecalibration(withMethod);

    return {
      totalRequests,
      successCount: successLogs.length,
      failedCount: failedLogs.length,
      patternHitRate: Math.round(patternHitRate * 10000) / 100, // % with 2 decimals
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      byMethod,
      byIntent,
      recalibration,
    };
  }

  /** สร้าง empty result */
  private emptyAnalytics(): ClassificationAnalytics {
    return {
      totalRequests: 0,
      successCount: 0,
      failedCount: 0,
      patternHitRate: 0,
      avgConfidence: 0,
      avgLatencyMs: 0,
      byMethod: [],
      byIntent: [],
      recalibration: [],
    };
  }

  /** ดึง method จาก aiSuggestionJson */
  private extractMethod(log: AiAuditLog): string {
    const json = log.aiSuggestionJson;
    return (json?.method as string) ?? 'unknown';
  }

  /** ดึง intentCode จาก aiSuggestionJson */
  private extractIntentCode(log: AiAuditLog): string {
    const json = log.aiSuggestionJson;
    return (json?.intentCode as string) ?? 'UNKNOWN';
  }

  /** สรุปสถิติแยกตาม method */
  private groupByMethod(
    logs: Array<AiAuditLog & { method: string }>
  ): MethodStats[] {
    const groups = new Map<string, AiAuditLog[]>();
    for (const log of logs) {
      const key = log.method;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    return Array.from(groups.entries()).map(([method, items]) => ({
      method,
      count: items.length,
      avgConfidence:
        Math.round(
          this.avg(items.map((l) => Number(l.confidenceScore ?? 0))) * 100
        ) / 100,
      avgLatencyMs:
        Math.round(this.avg(items.map((l) => l.processingTimeMs ?? 0)) * 100) /
        100,
    }));
  }

  /** สรุปสถิติแยกตาม intent code */
  private groupByIntent(
    logs: Array<AiAuditLog & { method: string; intentCode: string }>
  ): IntentStats[] {
    const groups = new Map<string, Array<AiAuditLog & { method: string }>>();
    for (const log of logs) {
      const key = log.intentCode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    return Array.from(groups.entries())
      .map(([intentCode, items]) => ({
        intentCode,
        count: items.length,
        avgConfidence:
          Math.round(
            this.avg(items.map((l) => Number(l.confidenceScore ?? 0))) * 100
          ) / 100,
        patternHits: items.filter((l) => l.method === 'pattern').length,
        llmHits: items.filter((l) => l.method === 'llm_fallback').length,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * สร้างคำแนะนำ Recalibration
   * Intent ที่ถูก classify ด้วย LLM บ่อย ควรเพิ่ม pattern
   */
  private buildRecalibration(
    logs: Array<AiAuditLog & { method: string; intentCode: string }>
  ): RecalibrationRecommendation[] {
    const llmLogs = logs.filter((l) => l.method === 'llm_fallback');
    const groups = new Map<string, AiAuditLog[]>();
    for (const log of llmLogs) {
      const key = log.intentCode;
      if (key === 'FALLBACK' || key === 'UNKNOWN') continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    return Array.from(groups.entries())
      .map(([intentCode, items]) => ({
        intentCode,
        llmCallCount: items.length,
        avgConfidence:
          Math.round(
            this.avg(items.map((l) => Number(l.confidenceScore ?? 0))) * 100
          ) / 100,
        priority: items.length, // ยิ่งเรียก LLM บ่อย = priority สูง
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // แสดง top 10
  }

  /** คำนวณค่าเฉลี่ย */
  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
