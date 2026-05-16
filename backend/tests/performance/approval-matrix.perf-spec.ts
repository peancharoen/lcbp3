// File: backend/tests/performance/approval-matrix.perf-spec.ts
// Change Log:
// - 2026-05-16: Performance test for Approval Matrix Service with 1000+ rules

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCodeService } from '../../src/modules/response-code/response-code.service';
import { ResponseCode } from '../../src/modules/response-code/entities/response-code.entity';
import { ResponseCodeRule } from '../../src/modules/response-code/entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../../src/modules/common/enums/review.enums';

describe('ApprovalMatrixService Performance', () => {
  let service: ResponseCodeService;
  let responseCodeRepo: Repository<ResponseCode>;
  let responseCodeRuleRepo: Repository<ResponseCodeRule>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseCodeService,
        {
          provide: getRepositoryToken(ResponseCode),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(ResponseCodeRule),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ResponseCodeService>(ResponseCodeService);
    responseCodeRepo = module.get<Repository<ResponseCode>>(
      getRepositoryToken(ResponseCode)
    );
    responseCodeRuleRepo = module.get<Repository<ResponseCodeRule>>(
      getRepositoryToken(ResponseCodeRule)
    );
  });

  it('should lookup 1000+ response code rules within 100ms', async () => {
    // Arrange: Create 1000+ mock response code rules
    const mockRules: Partial<ResponseCodeRule>[] = Array.from(
      { length: 1000 },
      (_, i) => ({
        id: i + 1,
        responseCodeId: (i % 10) + 1,
        documentTypeId: (i % 5) + 1,
        isRequired: i % 3 === 0,
        priority: (i % 5) + 1,
      })
    );

    jest
      .spyOn(responseCodeRepo, 'find')
      .mockResolvedValue(mockRules as ResponseCodeRule[]);
    jest.spyOn(responseCodeRuleRepo, 'find').mockResolvedValue([]);

    // Act: Measure lookup time
    const startTime = Date.now();
    const _result = await service.findByDocumentType(1, 'SHOP_DRAWING');
    const endTime = Date.now();

    // Assert: Must complete within 100ms
    const queryTime = endTime - startTime;
    expect(queryTime).toBeLessThan(100);
    // Log performance metric
    process.stdout.write(
      `Lookup ${mockRules.length} rules: ${queryTime}ms (target: <100ms)\n`
    );
  });

  it('should handle concurrent lookups efficiently', async () => {
    // Arrange: Mock dataset
    const mockCodes: Partial<ResponseCode>[] = Array.from(
      { length: 50 },
      (_, i): Partial<ResponseCode> => ({
        id: i + 1,
        code: `CODE-${i}`,
        category: (
          ['ENGINEERING', 'CONTRACT', 'QUALITY'] as ResponseCodeCategory[]
        )[i % 3],
        description: `Description for code ${i}`,
      })
    );

    jest
      .spyOn(responseCodeRepo, 'find')
      .mockResolvedValue(mockCodes as ResponseCode[]);
    jest.spyOn(responseCodeRuleRepo, 'find').mockResolvedValue([]);

    // Act: Run 10 concurrent lookups
    const startTime = Date.now();
    const promises = Array.from({ length: 10 }, () =>
      service.findByDocumentType(1, 'SHOP_DRAWING')
    );
    await Promise.all(promises);
    const endTime = Date.now();

    // Assert: Total time should still be reasonable
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(500); // Log performance metric
    process.stdout.write(
      `Concurrent lookups (50 codes): ${totalTime}ms (target: <500ms)\n`
    );
  });
});
