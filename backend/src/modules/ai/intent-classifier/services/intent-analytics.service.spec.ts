// File: src/modules/ai/intent-classifier/services/intent-analytics.service.spec.ts
// Change Log
// - 2026-05-21: แก้ไขการทำ Type Casting ของ AiAuditLog ใน Mock ให้สมบูรณ์ขึ้นด้วย unknown
// - 2026-05-19: สร้าง Unit tests สำหรับ IntentAnalyticsService (T033, US3).

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntentAnalyticsService } from './intent-analytics.service';
import { AiAuditLog, AiAuditStatus } from '../../entities/ai-audit-log.entity';

/** สร้าง mock audit log */
function mockLog(
  overrides: Partial<{
    method: string;
    intentCode: string;
    confidence: number;
    latencyMs: number;
    status: AiAuditStatus;
  }> = {}
): AiAuditLog {
  const method = overrides.method ?? 'pattern';
  const intentCode = overrides.intentCode ?? 'GET_RFA';
  return {
    id: Math.floor(Math.random() * 1000),
    publicId: 'mock-public-id',
    aiModel: 'intent-classifier',
    modelName: method === 'llm_fallback' ? 'gemma4:e4b' : 'pattern-match',
    aiSuggestionJson: {
      intentCode,
      confidence: overrides.confidence ?? 1.0,
      method,
      latencyMs: overrides.latencyMs ?? 3,
    },
    processingTimeMs: overrides.latencyMs ?? 3,
    confidenceScore: overrides.confidence ?? 1.0,
    status: overrides.status ?? AiAuditStatus.SUCCESS,
    createdAt: new Date(),
  } as unknown as AiAuditLog;
}

describe('IntentAnalyticsService', () => {
  let service: IntentAnalyticsService;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentAnalyticsService,
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<IntentAnalyticsService>(IntentAnalyticsService);
  });

  describe('getAnalytics', () => {
    it('ควร return empty analytics เมื่อไม่มี data', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getAnalytics();

      expect(result.totalRequests).toBe(0);
      expect(result.patternHitRate).toBe(0);
      expect(result.byMethod).toHaveLength(0);
      expect(result.byIntent).toHaveLength(0);
      expect(result.recalibration).toHaveLength(0);
    });

    it('ควรคำนวณ patternHitRate ถูกต้อง', async () => {
      const logs = [
        mockLog({ method: 'pattern', intentCode: 'GET_RFA' }),
        mockLog({ method: 'pattern', intentCode: 'SUMMARIZE_DOCUMENT' }),
        mockLog({ method: 'pattern', intentCode: 'GET_DRAWING' }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'GET_RFA',
          confidence: 0.85,
          latencyMs: 500,
        }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      expect(result.totalRequests).toBe(4);
      expect(result.patternHitRate).toBe(75); // 3/4 = 75%
    });

    it('ควรนับ success/failed ถูกต้อง', async () => {
      const logs = [
        mockLog({ method: 'pattern', status: AiAuditStatus.SUCCESS }),
        mockLog({ method: 'pattern', status: AiAuditStatus.SUCCESS }),
        mockLog({ method: 'llm_error', status: AiAuditStatus.FAILED }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    it('ควร group by method ถูกต้อง', async () => {
      const logs = [
        mockLog({ method: 'pattern', latencyMs: 2, confidence: 1.0 }),
        mockLog({ method: 'pattern', latencyMs: 4, confidence: 1.0 }),
        mockLog({ method: 'llm_fallback', latencyMs: 500, confidence: 0.8 }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      expect(result.byMethod).toHaveLength(2);
      const pattern = result.byMethod.find((m) => m.method === 'pattern');
      expect(pattern?.count).toBe(2);
      expect(pattern?.avgLatencyMs).toBe(3); // (2+4)/2
      expect(pattern?.avgConfidence).toBe(1.0);

      const llm = result.byMethod.find((m) => m.method === 'llm_fallback');
      expect(llm?.count).toBe(1);
      expect(llm?.avgLatencyMs).toBe(500);
    });

    it('ควร group by intent ถูกต้อง', async () => {
      const logs = [
        mockLog({ method: 'pattern', intentCode: 'GET_RFA' }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'GET_RFA',
          confidence: 0.9,
          latencyMs: 400,
        }),
        mockLog({ method: 'pattern', intentCode: 'SUMMARIZE_DOCUMENT' }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      expect(result.byIntent).toHaveLength(2);
      const rfa = result.byIntent.find((i) => i.intentCode === 'GET_RFA');
      expect(rfa?.count).toBe(2);
      expect(rfa?.patternHits).toBe(1);
      expect(rfa?.llmHits).toBe(1);
    });

    it('ควรสร้าง recalibration recommendations สำหรับ LLM-heavy intents', async () => {
      const logs = [
        mockLog({
          method: 'llm_fallback',
          intentCode: 'GET_DRAWING',
          confidence: 0.85,
        }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'GET_DRAWING',
          confidence: 0.78,
        }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'GET_DRAWING',
          confidence: 0.82,
        }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'LIST_OVERDUE',
          confidence: 0.7,
        }),
        mockLog({ method: 'pattern', intentCode: 'GET_RFA' }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      // GET_DRAWING ถูก LLM classify 3 ครั้ง → ควรอยู่อันดับ 1
      expect(result.recalibration.length).toBeGreaterThan(0);
      expect(result.recalibration[0].intentCode).toBe('GET_DRAWING');
      expect(result.recalibration[0].llmCallCount).toBe(3);
    });

    it('ควรไม่ include FALLBACK ใน recalibration', async () => {
      const logs = [
        mockLog({
          method: 'llm_fallback',
          intentCode: 'FALLBACK',
          confidence: 0.2,
        }),
        mockLog({
          method: 'llm_fallback',
          intentCode: 'FALLBACK',
          confidence: 0.15,
        }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(logs);

      const result = await service.getAnalytics();

      expect(result.recalibration).toHaveLength(0);
    });

    it('ควรรับ date range parameters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await service.getAnalytics(from, to);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'a.createdAt BETWEEN :from AND :to',
        { from, to }
      );
    });
  });
});
