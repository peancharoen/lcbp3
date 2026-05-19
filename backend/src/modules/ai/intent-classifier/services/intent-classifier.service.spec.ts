// File: src/modules/ai/intent-classifier/services/intent-classifier.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit Tests สำหรับ IntentClassifierService (ADR-024).

import { IntentClassifierService } from './intent-classifier.service';
import { IntentPatternCacheService } from './intent-pattern-cache.service';
import { PatternMatcherService } from './pattern-matcher.service';
import { OllamaClientService } from './ollama-client.service';
import { LlmSemaphoreService } from './llm-semaphore.service';
import { ClassificationAuditService } from './classification-audit.service';
import { CachedPattern } from '../interfaces/classification-result.interface';

describe('IntentClassifierService', () => {
  let service: IntentClassifierService;
  let cacheService: jest.Mocked<IntentPatternCacheService>;
  let patternMatcher: jest.Mocked<PatternMatcherService>;
  let ollamaClient: jest.Mocked<OllamaClientService>;
  let semaphore: jest.Mocked<LlmSemaphoreService>;
  let auditService: jest.Mocked<ClassificationAuditService>;

  const mockPatterns: CachedPattern[] = [
    {
      publicId: 'uuid-1',
      intentCode: 'SUMMARIZE_DOCUMENT',
      language: 'th',
      patternType: 'keyword',
      patternValue: 'สรุป',
      priority: 10,
    },
  ];

  beforeEach(() => {
    cacheService = {
      getActivePatterns: jest.fn().mockResolvedValue(mockPatterns),
      invalidate: jest.fn(),
    } as unknown as jest.Mocked<IntentPatternCacheService>;

    patternMatcher = {
      match: jest.fn(),
    } as unknown as jest.Mocked<PatternMatcherService>;

    ollamaClient = {
      classifyIntent: jest.fn(),
    } as unknown as jest.Mocked<OllamaClientService>;

    semaphore = {
      tryAcquire: jest.fn(),
      activeCount: 0,
      pendingCount: 0,
      isFull: false,
    } as unknown as jest.Mocked<LlmSemaphoreService>;

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClassificationAuditService>;

    service = new IntentClassifierService(
      cacheService,
      patternMatcher,
      ollamaClient,
      semaphore,
      auditService
    );
  });

  describe('classify', () => {
    it('ควร return pattern match result เมื่อ pattern ตรง', async () => {
      patternMatcher.match.mockReturnValue({
        intentCode: 'SUMMARIZE_DOCUMENT',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 5,
      });

      const result = await service.classify({ query: 'สรุปเอกสาร' });

      expect(result.intentCode).toBe('SUMMARIZE_DOCUMENT');
      expect(result.method).toBe('pattern');
      expect(result.confidence).toBe(1.0);
      expect(ollamaClient.classifyIntent).not.toHaveBeenCalled();
    });

    it('ควร fallback ไป LLM เมื่อ pattern ไม่ match', async () => {
      patternMatcher.match.mockReturnValue(null);
      semaphore.tryAcquire.mockReturnValue(jest.fn());
      ollamaClient.classifyIntent.mockResolvedValue({
        intent: 'GET_RFA',
        confidence: 0.85,
      });

      const result = await service.classify({ query: 'show me RFA' });

      expect(result.intentCode).toBe('GET_RFA');
      expect(result.method).toBe('llm_fallback');
      expect(result.confidence).toBe(0.85);
    });

    it('ควร return FALLBACK เมื่อ semaphore เต็ม (overflow)', async () => {
      patternMatcher.match.mockReturnValue(null);
      semaphore.tryAcquire.mockReturnValue(null);

      const result = await service.classify({ query: 'unknown' });

      expect(result.intentCode).toBe('FALLBACK');
      expect(result.method).toBe('semaphore_overflow');
      expect(result.confidence).toBe(0);
    });

    it('ควร return FALLBACK เมื่อ LLM error', async () => {
      patternMatcher.match.mockReturnValue(null);
      semaphore.tryAcquire.mockReturnValue(jest.fn());
      ollamaClient.classifyIntent.mockResolvedValue(null);

      const result = await service.classify({ query: 'random query' });

      expect(result.intentCode).toBe('FALLBACK');
      expect(result.method).toBe('llm_error');
    });

    it('ควร release semaphore หลังจาก LLM call เสร็จ', async () => {
      patternMatcher.match.mockReturnValue(null);
      const releaseFn = jest.fn();
      semaphore.tryAcquire.mockReturnValue(releaseFn);
      ollamaClient.classifyIntent.mockResolvedValue({
        intent: 'GET_RFA',
        confidence: 0.9,
      });

      await service.classify({ query: 'test' });

      expect(releaseFn).toHaveBeenCalledTimes(1);
    });

    it('ควร release semaphore แม้ LLM throw error', async () => {
      patternMatcher.match.mockReturnValue(null);
      const releaseFn = jest.fn();
      semaphore.tryAcquire.mockReturnValue(releaseFn);
      ollamaClient.classifyIntent.mockRejectedValue(new Error('timeout'));

      await expect(service.classify({ query: 'test' })).rejects.toThrow();
      expect(releaseFn).toHaveBeenCalledTimes(1);
    });
  });
});
