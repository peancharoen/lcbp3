// File: src/modules/ai/intent-classifier/services/pattern-matcher.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit Tests สำหรับ PatternMatcherService (ADR-024).

import { PatternMatcherService } from './pattern-matcher.service';
import { CachedPattern } from '../interfaces/classification-result.interface';

describe('PatternMatcherService', () => {
  let service: PatternMatcherService;

  beforeEach(() => {
    service = new PatternMatcherService();
  });

  const mockPatterns: CachedPattern[] = [
    {
      publicId: 'uuid-1',
      intentCode: 'SUMMARIZE_DOCUMENT',
      language: 'th',
      patternType: 'keyword',
      patternValue: 'สรุป',
      priority: 10,
    },
    {
      publicId: 'uuid-2',
      intentCode: 'GET_RFA',
      language: 'en',
      patternType: 'regex',
      patternValue: '\\brfa\\b',
      priority: 20,
    },
    {
      publicId: 'uuid-3',
      intentCode: 'GET_DRAWING',
      language: 'any',
      patternType: 'keyword',
      patternValue: 'drawing',
      priority: 30,
    },
  ];

  describe('match', () => {
    it('ควร match keyword pattern (case-insensitive)', () => {
      const result = service.match('สรุปเอกสารนี้', mockPatterns);
      expect(result).not.toBeNull();
      expect(result!.intentCode).toBe('SUMMARIZE_DOCUMENT');
      expect(result!.confidence).toBe(1.0);
      expect(result!.method).toBe('pattern');
    });

    it('ควร match regex pattern', () => {
      const result = service.match('show me the RFA list', mockPatterns);
      expect(result).not.toBeNull();
      expect(result!.intentCode).toBe('GET_RFA');
      expect(result!.confidence).toBe(1.0);
      expect(result!.method).toBe('pattern');
    });

    it('ควร return null เมื่อไม่มี pattern ที่ match', () => {
      const result = service.match('hello world', mockPatterns);
      expect(result).toBeNull();
    });

    it('ควร match ตาม priority (ต่ำสุดก่อน)', () => {
      const result = service.match('สรุป drawing', mockPatterns);
      expect(result).not.toBeNull();
      // priority 10 (สรุป) ก่อน priority 30 (drawing)
      expect(result!.intentCode).toBe('SUMMARIZE_DOCUMENT');
    });

    it('ควรไม่ crash เมื่อ regex pattern ไม่ถูกต้อง', () => {
      const badPatterns: CachedPattern[] = [
        {
          publicId: 'uuid-bad',
          intentCode: 'BAD',
          language: 'any',
          patternType: 'regex',
          patternValue: '[invalid(regex',
          priority: 1,
        },
      ];
      const result = service.match('test', badPatterns);
      expect(result).toBeNull();
    });

    it('ควร return latencyMs >= 0', () => {
      const result = service.match('สรุป', mockPatterns);
      expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('ควรทำงานกับ patterns ว่าง', () => {
      const result = service.match('test', []);
      expect(result).toBeNull();
    });
  });
});
