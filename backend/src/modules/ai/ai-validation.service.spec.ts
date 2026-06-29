// File: src/modules/ai/ai-validation.service.spec.ts
// Unit Tests สำหรับ AiValidationService — ตรวจสอบ Confidence Thresholds และ Validation Logic (ADR-020)

import { Test, TestingModule } from '@nestjs/testing';
import { AiValidationService } from './ai-validation.service';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { AiAuditStatus } from './entities/ai-audit-log.entity';

describe('AiValidationService', () => {
  let service: AiValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiValidationService],
    }).compile();

    service = module.get<AiValidationService>(AiValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- getConfidenceAction ---

  describe('getConfidenceAction', () => {
    it('ควรคืน auto_approve เมื่อ confidence >= 0.95', () => {
      expect(service.getConfidenceAction(0.95)).toBe('auto_approve');
      expect(service.getConfidenceAction(1.0)).toBe('auto_approve');
      expect(service.getConfidenceAction(0.99)).toBe('auto_approve');
    });

    it('ควรคืน low_priority_review เมื่อ confidence 0.85-0.94', () => {
      expect(service.getConfidenceAction(0.85)).toBe('low_priority_review');
      expect(service.getConfidenceAction(0.9)).toBe('low_priority_review');
      expect(service.getConfidenceAction(0.94)).toBe('low_priority_review');
    });

    it('ควรคืน high_priority_review เมื่อ confidence 0.60-0.84', () => {
      expect(service.getConfidenceAction(0.6)).toBe('high_priority_review');
      expect(service.getConfidenceAction(0.75)).toBe('high_priority_review');
      expect(service.getConfidenceAction(0.84)).toBe('high_priority_review');
    });

    it('ควรคืน reject เมื่อ confidence < 0.60', () => {
      expect(service.getConfidenceAction(0.59)).toBe('reject');
      expect(service.getConfidenceAction(0.0)).toBe('reject');
      expect(service.getConfidenceAction(0.3)).toBe('reject');
    });
  });

  // --- validateAiOutput ---

  describe('validateAiOutput', () => {
    // สร้าง Payload ตัวอย่างที่ถูกต้อง
    const buildPayload = (
      overrides: Partial<AiCallbackDto> = {}
    ): AiCallbackDto => ({
      migrationLogPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      aiModel: 'gemma4',
      status: AiAuditStatus.SUCCESS,
      confidenceScore: 0.9,
      extractedMetadata: {
        subject: 'ทดสอบ',
        date: '2026-04-09',
        discipline: 'Civil',
      },
      ...overrides,
    });

    it('ควร valid เมื่อ confidence >= 0.60 และ status = SUCCESS', () => {
      const result = service.validateAiOutput(
        buildPayload({ confidenceScore: 0.9 })
      );
      expect(result.isValid).toBe(true);
      expect(result.action).toBe('low_priority_review');
    });

    it('ควร invalid เมื่อ status = FAILED', () => {
      const result = service.validateAiOutput(
        buildPayload({ status: AiAuditStatus.FAILED })
      );
      expect(result.isValid).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('ควร invalid เมื่อ status = TIMEOUT', () => {
      const result = service.validateAiOutput(
        buildPayload({ status: AiAuditStatus.TIMEOUT })
      );
      expect(result.isValid).toBe(false);
    });

    it('ควร invalid เมื่อ confidence < 0.60', () => {
      const result = service.validateAiOutput(
        buildPayload({ confidenceScore: 0.55 })
      );
      expect(result.isValid).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reasons.some((r) => r.includes('0.55'))).toBe(true);
    });

    it('ควร valid พร้อม auto_approve เมื่อ confidence >= 0.95', () => {
      const result = service.validateAiOutput(
        buildPayload({ confidenceScore: 0.97 })
      );
      expect(result.isValid).toBe(true);
      expect(result.action).toBe('auto_approve');
    });

    it('ควร invalid เมื่อ discipline ไม่ถูกต้อง', () => {
      const result = service.validateAiOutput(
        buildPayload({
          confidenceScore: 0.9,
          extractedMetadata: { discipline: 'InvalidDiscipline' },
        })
      );
      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('discipline'))).toBe(true);
    });

    it('ควรยอมรับ discipline ที่ถูกต้องทั้ง 4 ค่า', () => {
      const validDisciplines = [
        'Civil',
        'Mechanical',
        'Electrical',
        'Architectural',
      ];
      for (const discipline of validDisciplines) {
        const result = service.validateAiOutput(
          buildPayload({
            confidenceScore: 0.9,
            extractedMetadata: { discipline },
          })
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('ควร invalid เมื่อ date format ผิด', () => {
      const result = service.validateAiOutput(
        buildPayload({
          confidenceScore: 0.9,
          extractedMetadata: { date: '09/04/2026' }, // รูปแบบผิด
        })
      );
      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('date'))).toBe(true);
    });

    it('ควร valid เมื่อไม่มี extractedMetadata (metadata เป็น optional)', () => {
      const result = service.validateAiOutput(
        buildPayload({ confidenceScore: 0.9, extractedMetadata: undefined })
      );
      expect(result.isValid).toBe(true);
    });

    it('ควร valid เมื่อ confidence = undefined (ถือว่า 0 — reject)', () => {
      const result = service.validateAiOutput(
        buildPayload({ confidenceScore: undefined })
      );
      expect(result.isValid).toBe(false);
      expect(result.action).toBe('reject');
    });
  });

  // --- buildAuditSummary ---

  describe('buildAuditSummary', () => {
    it('ควรสร้าง Summary string ที่มีข้อมูลครบถ้วน', () => {
      const payload: AiCallbackDto = {
        migrationLogPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        aiModel: 'gemma4',
        status: AiAuditStatus.SUCCESS,
        confidenceScore: 0.92,
      };
      const validationResult = {
        isValid: true,
        action: 'low_priority_review' as const,
        confidence: 0.92,
        reasons: [],
      };

      const summary = service.buildAuditSummary(payload, validationResult);

      expect(summary).toContain('model=gemma4');
      expect(summary).toContain('confidence=0.92');
      expect(summary).toContain('action=low_priority_review');
      expect(summary).toContain('valid=true');
    });

    it('ควรแสดง reasons เมื่อ validation ล้มเหลว', () => {
      const payload: AiCallbackDto = {
        migrationLogPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        aiModel: 'gemma4',
        status: AiAuditStatus.FAILED,
      };
      const validationResult = {
        isValid: false,
        action: 'reject' as const,
        confidence: 0,
        reasons: ['AI processing failed with status: FAILED'],
      };

      const summary = service.buildAuditSummary(payload, validationResult);
      expect(summary).toContain('reasons=');
      expect(summary).toContain('FAILED');
    });
  });
});
