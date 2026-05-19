// File: src/modules/ai/intent-classifier/services/pattern-matcher.service.ts
// Change Log
// - 2026-05-19: สร้าง Pattern Matcher Service — จับคู่ query กับ cached patterns (ADR-024).

import { Injectable, Logger } from '@nestjs/common';
import {
  CachedPattern,
  ClassificationResult,
} from '../interfaces/classification-result.interface';

/**
 * Service สำหรับจับคู่ query กับ Intent Patterns
 * Strategy: iterate ตาม priority (ASC) — keyword ใช้ includes, regex ใช้ RegExp.test
 * ผลลัพธ์แรกที่ match จะ return ทันที (confidence = 1.0)
 */
@Injectable()
export class PatternMatcherService {
  private readonly logger = new Logger(PatternMatcherService.name);

  /**
   * จับคู่ query กับ patterns ที่ cache ไว้
   * @returns ClassificationResult ถ้า match, null ถ้าไม่ match
   */
  match(query: string, patterns: CachedPattern[]): ClassificationResult | null {
    const normalizedQuery = query.toLowerCase().trim();
    const startTime = Date.now();

    for (const pattern of patterns) {
      if (this.isPatternMatch(normalizedQuery, pattern)) {
        return {
          intentCode: pattern.intentCode,
          confidence: 1.0,
          method: 'pattern',
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return null;
  }

  /** ตรวจสอบว่า query match กับ pattern หรือไม่ */
  private isPatternMatch(
    normalizedQuery: string,
    pattern: CachedPattern
  ): boolean {
    try {
      if (pattern.patternType === 'keyword') {
        return normalizedQuery.includes(pattern.patternValue.toLowerCase());
      }

      if (pattern.patternType === 'regex') {
        const regex = new RegExp(pattern.patternValue, 'i');
        return regex.test(normalizedQuery);
      }

      return false;
    } catch (err) {
      // Invalid regex จะไม่ crash — log แล้วข้ามไป
      this.logger.warn(
        `Invalid pattern "${pattern.patternValue}" (${pattern.publicId}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return false;
    }
  }
}
