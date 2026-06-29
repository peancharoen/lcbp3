// File: src/modules/ai/intent-classifier/services/intent-classifier.service.ts
// Change Log
// - 2026-05-19: สร้าง Core Orchestrator — Hybrid Strategy: Pattern First → LLM Fallback (ADR-024).

import { Injectable, Logger } from '@nestjs/common';
import {
  ClassificationInput,
  ClassificationResult,
} from '../interfaces/classification-result.interface';
import { IntentPatternCacheService } from './intent-pattern-cache.service';
import { PatternMatcherService } from './pattern-matcher.service';
import { OllamaClientService } from './ollama-client.service';
import { LlmSemaphoreService } from './llm-semaphore.service';
import { ClassificationAuditService } from './classification-audit.service';

/** FALLBACK intent เมื่อไม่สามารถจำแนกได้ */
const FALLBACK_INTENT = 'FALLBACK';

/**
 * Core Intent Classifier Service
 * Hybrid Strategy:
 * 1. Pattern Match (cache-first, < 50ms)
 * 2. LLM Fallback (Ollama, semaphore-guarded)
 * 3. Fallback: FALLBACK intent
 */
@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(
    private readonly cacheService: IntentPatternCacheService,
    private readonly patternMatcher: PatternMatcherService,
    private readonly ollamaClient: OllamaClientService,
    private readonly semaphore: LlmSemaphoreService,
    private readonly auditService: ClassificationAuditService
  ) {}

  /**
   * จำแนก Intent จาก user query
   * Flow: Cache patterns → Pattern match → LLM fallback → FALLBACK
   */
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const startTime = Date.now();

    // Step 1: ดึง cached patterns
    const patterns = await this.cacheService.getActivePatterns();

    // Step 2: Pattern matching
    const patternResult = this.patternMatcher.match(input.query, patterns);
    if (patternResult) {
      this.logger.debug(
        `Pattern match: "${input.query}" → ${patternResult.intentCode}`
      );
      // Audit log (fire-and-forget)
      void this.auditService.log({ input, result: patternResult });
      return patternResult;
    }

    // Step 3: LLM Fallback (semaphore-guarded)
    const llmResult = await this.llmFallback(input.query, startTime);
    // Audit log (fire-and-forget)
    void this.auditService.log({ input, result: llmResult });
    return llmResult;
  }

  /** LLM Fallback — ใช้ semaphore ควบคุม concurrency */
  private async llmFallback(
    query: string,
    startTime: number
  ): Promise<ClassificationResult> {
    // Try acquire — ถ้าเต็มจะ return FALLBACK ทันที (semaphore_overflow)
    const release = this.semaphore.tryAcquire();
    if (!release) {
      this.logger.warn(
        `Semaphore overflow: active=${this.semaphore.activeCount}, pending=${this.semaphore.pendingCount}`
      );
      return {
        intentCode: FALLBACK_INTENT,
        confidence: 0,
        method: 'semaphore_overflow',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.ollamaClient.classifyIntent(query);

      if (result) {
        this.logger.debug(
          `LLM fallback: "${query}" → ${result.intent} (${result.confidence})`
        );
        return {
          intentCode: result.intent,
          confidence: result.confidence,
          method: 'llm_fallback',
          latencyMs: Date.now() - startTime,
        };
      }

      // LLM ไม่สามารถ parse ได้ → FALLBACK
      return {
        intentCode: FALLBACK_INTENT,
        confidence: 0,
        method: 'llm_error',
        latencyMs: Date.now() - startTime,
      };
    } finally {
      release();
    }
  }
}
