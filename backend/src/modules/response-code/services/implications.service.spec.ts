// File: src/modules/response-code/services/implications.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ ImplicationsService (FR-007)

import { Test, TestingModule } from '@nestjs/testing';
import { ImplicationsService } from './implications.service';
import { ResponseCode } from '../entities/response-code.entity';

// Helper สร้าง mock ResponseCode
const makeCode = (
  code: string,
  overrides: Partial<ResponseCode> = {}
): ResponseCode =>
  ({
    id: 1,
    code,
    descriptionTh: 'ทดสอบ',
    descriptionEn: 'Test',
    category: 'ENGINEERING',
    isSystem: false,
    isActive: true,
    implications: {},
    notifyRoles: [],
    ...overrides,
  }) as unknown as ResponseCode;

describe('ImplicationsService', () => {
  let service: ImplicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImplicationsService],
    }).compile();
    service = module.get<ImplicationsService>(ImplicationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate — severity', () => {
    it('ควรคืน CRITICAL เมื่อ code=3 (Rejected)', () => {
      const result = service.evaluate(makeCode('3'));
      expect(result.severity).toBe('CRITICAL');
    });

    it('ควรคืน HIGH เมื่อ code=1C', () => {
      const result = service.evaluate(makeCode('1C'));
      expect(result.severity).toBe('HIGH');
    });

    it('ควรคืน HIGH เมื่อ code=1D', () => {
      const result = service.evaluate(makeCode('1D'));
      expect(result.severity).toBe('HIGH');
    });

    it('ควรคืน HIGH เมื่อ affectsSchedule=true และ affectsCost=true', () => {
      const result = service.evaluate(
        makeCode('2', {
          implications: { affectsSchedule: true, affectsCost: true },
        } as Partial<ResponseCode>)
      );
      expect(result.severity).toBe('HIGH');
    });

    it('ควรคืน MEDIUM เมื่อ requiresContractReview=true', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { requiresContractReview: true },
        } as Partial<ResponseCode>)
      );
      expect(result.severity).toBe('MEDIUM');
    });

    it('ควรคืน MEDIUM เมื่อ affectsSchedule=true', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { affectsSchedule: true },
        } as Partial<ResponseCode>)
      );
      expect(result.severity).toBe('MEDIUM');
    });

    it('ควรคืน MEDIUM เมื่อ affectsCost=true', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { affectsCost: true },
        } as Partial<ResponseCode>)
      );
      expect(result.severity).toBe('MEDIUM');
    });

    it('ควรคืน LOW เมื่อไม่มีผลกระทบใดๆ', () => {
      const result = service.evaluate(makeCode('1A'));
      expect(result.severity).toBe('LOW');
    });
  });

  describe('evaluate — actionRequired', () => {
    it('ควรเพิ่ม action สำหรับ code=3', () => {
      const result = service.evaluate(makeCode('3'));
      expect(result.actionRequired).toContain(
        'Document rejected — originator must revise and resubmit'
      );
    });

    it('ควรเพิ่ม action สำหรับ requiresContractReview', () => {
      const result = service.evaluate(
        makeCode('1C', {
          implications: { requiresContractReview: true },
        } as Partial<ResponseCode>)
      );
      expect(result.actionRequired).toContain(
        'Contract review required — notify Contract Manager'
      );
    });

    it('ควรเพิ่ม action สำหรับ affectsCost', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { affectsCost: true },
        } as Partial<ResponseCode>)
      );
      expect(result.actionRequired).toContain(
        'Cost impact assessment required — notify QS Manager'
      );
    });

    it('ควรเพิ่ม action สำหรับ requiresEiaAmendment', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { requiresEiaAmendment: true },
        } as Partial<ResponseCode>)
      );
      expect(result.actionRequired).toContain(
        'EIA amendment may be required — notify EIA Officer'
      );
    });

    it('ควรเพิ่ม action สำหรับ code=2', () => {
      const result = service.evaluate(makeCode('2'));
      expect(result.actionRequired).toContain(
        'Minor comments — originator to revise and resubmit'
      );
    });

    it('ควรคืน actionRequired ว่างเมื่อ code=1A ไม่มี implications', () => {
      const result = service.evaluate(makeCode('1A'));
      expect(result.actionRequired).toHaveLength(0);
    });
  });

  describe('evaluate — flags', () => {
    it('ควรคืน affectsSchedule=true จาก implications', () => {
      const result = service.evaluate(
        makeCode('1B', {
          implications: { affectsSchedule: true },
        } as Partial<ResponseCode>)
      );
      expect(result.affectsSchedule).toBe(true);
    });

    it('ควร default ทุก flag เป็น false เมื่อ implications ว่าง', () => {
      const result = service.evaluate(makeCode('1A'));
      expect(result.affectsSchedule).toBe(false);
      expect(result.affectsCost).toBe(false);
      expect(result.requiresContractReview).toBe(false);
      expect(result.requiresEiaAmendment).toBe(false);
    });

    it('ควรคืน notifyRoles จาก responseCode', () => {
      const result = service.evaluate(
        makeCode('3', {
          notifyRoles: ['CONTRACT_MANAGER', 'QS_MANAGER'],
        } as Partial<ResponseCode>)
      );
      expect(result.notifyRoles).toEqual(['CONTRACT_MANAGER', 'QS_MANAGER']);
    });
  });
});
