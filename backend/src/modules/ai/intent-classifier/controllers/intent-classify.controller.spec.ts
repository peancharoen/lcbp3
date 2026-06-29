// File: src/modules/ai/intent-classifier/controllers/intent-classify.controller.spec.ts
// Change Log
// - 2026-05-19: สร้าง Integration test สำหรับ Classification API (T026, US2).

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { IntentClassifyController } from './intent-classify.controller';
import { IntentClassifierService } from '../services/intent-classifier.service';
import { ClassificationResult } from '../interfaces/classification-result.interface';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/** Guard stub ที่ allow ทุก request */
const mockGuard = { canActivate: () => true };

describe('IntentClassifyController', () => {
  let controller: IntentClassifyController;
  let classifierService: jest.Mocked<IntentClassifierService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntentClassifyController],
      providers: [
        {
          provide: IntentClassifierService,
          useValue: {
            classify: jest.fn(),
          },
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<IntentClassifyController>(IntentClassifyController);
    classifierService = module.get(IntentClassifierService);
  });

  describe('classify', () => {
    it('ควรเรียก service.classify ด้วย trimmed query', async () => {
      const mockResult: ClassificationResult = {
        intentCode: 'SUMMARIZE_DOCUMENT',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 3,
      };
      classifierService.classify.mockResolvedValue(mockResult);

      const result = await controller.classify({
        query: '  สรุปเอกสาร  ',
        projectPublicId: undefined,
        userPublicId: undefined,
        currentDocumentId: undefined,
      });

      expect(classifierService.classify).toHaveBeenCalledWith({
        query: 'สรุปเอกสาร',
        projectPublicId: undefined,
        userPublicId: undefined,
        currentDocumentId: undefined,
      });
      expect(result.intentCode).toBe('SUMMARIZE_DOCUMENT');
      expect(result.method).toBe('pattern');
    });

    it('ควรส่ง context parameters ไปด้วย', async () => {
      const mockResult: ClassificationResult = {
        intentCode: 'GET_RFA',
        confidence: 0.9,
        method: 'llm_fallback',
        latencyMs: 500,
      };
      classifierService.classify.mockResolvedValue(mockResult);

      await controller.classify({
        query: 'show rfa',
        projectPublicId: 'proj-uuid-123',
        userPublicId: 'user-uuid-456',
        currentDocumentId: 'doc-uuid-789',
      });

      expect(classifierService.classify).toHaveBeenCalledWith({
        query: 'show rfa',
        projectPublicId: 'proj-uuid-123',
        userPublicId: 'user-uuid-456',
        currentDocumentId: 'doc-uuid-789',
      });
    });

    it('ควร return ClassificationResult', async () => {
      const mockResult: ClassificationResult = {
        intentCode: 'FALLBACK',
        confidence: 0,
        method: 'semaphore_overflow',
        latencyMs: 1,
      };
      classifierService.classify.mockResolvedValue(mockResult);

      const result = await controller.classify({
        query: 'test',
      });

      expect(result).toEqual(mockResult);
    });
  });
});
