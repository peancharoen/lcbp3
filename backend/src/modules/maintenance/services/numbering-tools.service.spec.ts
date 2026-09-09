// File: backend/src/modules/maintenance/services/numbering-tools.service.spec.ts
// Change Log:
// - 2026-09-09: Initial creation. Regression coverage for the full rewrite that
//   replaced raw SQL against an invented table (document_numbering_counters,
//   counter_key) with reads/writes against the real document_number_counters
//   (composite PK) and document_number_audit tables, delegating writes to the
//   already-safe ManualOverrideService instead of raw UPDATE statements.

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { NumberingToolsService } from './numbering-tools.service';
import { ManualOverrideService } from '../../document-numbering/services/manual-override.service';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { ValidationException } from '../../../common/exceptions/base.exception';

describe('NumberingToolsService', () => {
  let service: NumberingToolsService;
  let mockCounterRepo: { find: jest.Mock; findOne: jest.Mock };
  let mockAuditQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };
  let mockAuditRepo: { createQueryBuilder: jest.Mock };
  let mockDataSource: { getRepository: jest.Mock };
  let mockManualOverrideService: jest.Mocked<ManualOverrideService>;
  let mockUuidResolverService: jest.Mocked<UuidResolverService>;

  // Shape of a document_number_counters row (DB entity — uses `originatorId`)
  const baseCounter = {
    projectId: 3,
    originatorId: 42,
    recipientOrganizationId: 22,
    correspondenceTypeId: 1,
    subTypeId: 0,
    rfaTypeId: 0,
    disciplineId: 0,
    resetScope: 'YEAR_2026',
    lastNumber: 5,
  };

  // Shape of a document_number_audit.counter_key JSON value (CounterKeyDto —
  // uses `originatorOrganizationId`, matching baseCounter's composite key)
  const matchingAuditKey = {
    projectId: 3,
    originatorOrganizationId: 42,
    recipientOrganizationId: 22,
    correspondenceTypeId: 1,
    subTypeId: 0,
    rfaTypeId: 0,
    disciplineId: 0,
    resetScope: 'YEAR_2026',
  };

  beforeEach(async () => {
    mockCounterRepo = { find: jest.fn(), findOne: jest.fn() };
    mockAuditQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockAuditRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockAuditQueryBuilder),
    };
    mockDataSource = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'DocumentNumberCounter') return mockCounterRepo;
        return mockAuditRepo;
      }),
    };
    mockManualOverrideService = {
      applyOverride: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ManualOverrideService>;
    mockUuidResolverService = {
      resolveProjectId: jest.fn().mockResolvedValue(3),
    } as unknown as jest.Mocked<UuidResolverService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingToolsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ManualOverrideService, useValue: mockManualOverrideService },
        { provide: UuidResolverService, useValue: mockUuidResolverService },
      ],
    }).compile();

    service = module.get<NumberingToolsService>(NumberingToolsService);
  });

  describe('findGaps', () => {
    it('returns expectedNext/actualNext matching when audit count equals lastNumber', async () => {
      mockCounterRepo.find.mockResolvedValue([{ ...baseCounter }]);
      mockAuditQueryBuilder.getMany.mockResolvedValue([
        { counterKey: { ...matchingAuditKey } },
        { counterKey: { ...matchingAuditKey } },
        { counterKey: { ...matchingAuditKey } },
        { counterKey: { ...matchingAuditKey } },
        { counterKey: { ...matchingAuditKey } },
      ]);

      const result = await service.findGaps();

      expect(result).toHaveLength(1);
      expect(result[0].expectedNext).toBe(6);
      expect(result[0].actualNext).toBe(6);
      expect(result[0].missingNumbers).toEqual([]);
    });

    it('flags a gap signal when successful audit count is behind lastNumber', async () => {
      mockCounterRepo.find.mockResolvedValue([
        { ...baseCounter, lastNumber: 5 },
      ]);
      // เหลือแค่ 2 audit row สำเร็จ ทั้งที่ counter เดินไปถึง 5 แล้ว — สัญญาณว่ามี gap
      mockAuditQueryBuilder.getMany.mockResolvedValue([
        { counterKey: { ...matchingAuditKey } },
        { counterKey: { ...matchingAuditKey } },
      ]);

      const result = await service.findGaps();

      expect(result[0].expectedNext).toBe(6);
      expect(result[0].actualNext).toBe(3);
      expect(result[0].expectedNext).not.toBe(result[0].actualNext);
    });

    it('matches audit counterKey field-by-field, ignoring key ordering/extra fields', async () => {
      mockCounterRepo.find.mockResolvedValue([
        { ...baseCounter, lastNumber: 1 },
      ]);
      mockAuditQueryBuilder.getMany.mockResolvedValue([
        {
          // extra/differently-ordered fields — must still match on the 7 required ones
          counterKey: {
            resetScope: 'YEAR_2026',
            disciplineId: 0,
            rfaTypeId: 0,
            subTypeId: 0,
            correspondenceTypeId: 1,
            recipientOrganizationId: 22,
            originatorOrganizationId: 42,
            projectId: 3,
            extraneousField: 'ignored',
          },
        },
      ]);

      const result = await service.findGaps();

      expect(result[0].actualNext).toBe(2);
    });

    it('does not match audit rows with a different resetScope', async () => {
      mockCounterRepo.find.mockResolvedValue([
        { ...baseCounter, lastNumber: 3 },
      ]);
      mockAuditQueryBuilder.getMany.mockResolvedValue([
        { counterKey: { ...matchingAuditKey, resetScope: 'YEAR_2025' } },
      ]);

      const result = await service.findGaps();

      expect(result[0].actualNext).toBe(1);
    });

    it('resolves projectPublicId to internal project_id before querying', async () => {
      mockCounterRepo.find.mockResolvedValue([]);

      await service.findGaps('019505a1-7c3e-7000-8000-proj33333333');

      expect(mockUuidResolverService.resolveProjectId).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-proj33333333'
      );
      expect(mockCounterRepo.find).toHaveBeenCalledWith({
        where: { projectId: 3 },
      });
    });
  });

  describe('syncCounters', () => {
    it('never mutates counter data and always returns updated: 0', async () => {
      mockCounterRepo.find.mockResolvedValue([{ ...baseCounter }]);
      mockAuditQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.syncCounters();

      expect(result).toEqual({ updated: 0 });
      expect(mockManualOverrideService.applyOverride).not.toHaveBeenCalled();
    });
  });

  describe('overrideCounter', () => {
    const validToken = JSON.stringify({
      projectId: 3,
      originatorOrganizationId: 42,
      recipientOrganizationId: 22,
      correspondenceTypeId: 1,
      subTypeId: 0,
      rfaTypeId: 0,
      disciplineId: 0,
      resetScope: 'YEAR_2026',
    });

    it('parses a valid token and delegates to ManualOverrideService', async () => {
      mockCounterRepo.findOne.mockResolvedValue({
        ...baseCounter,
        lastNumber: 5,
      });

      const result = await service.overrideCounter(
        validToken,
        10,
        1,
        'correction'
      );

      expect(mockManualOverrideService.applyOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 3,
          originatorOrganizationId: 42,
          newLastNumber: 10,
          reason: 'correction',
        }),
        1
      );
      expect(result.previousValue).toBe(5);
      expect(result.newValue).toBe(10);
    });

    it('defaults previousValue to 0 when no counter row exists yet', async () => {
      mockCounterRepo.findOne.mockResolvedValue(null);

      const result = await service.overrideCounter(validToken, 10, 1, 'seed');

      expect(result.previousValue).toBe(0);
    });

    it('throws ValidationException with a Thai userMessage on malformed JSON', async () => {
      await expect(
        service.overrideCounter('not-json', 10, 1, 'x')
      ).rejects.toThrow(ValidationException);
      try {
        await service.overrideCounter('not-json', 10, 1, 'x');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationException);
        expect((err as ValidationException).userMessage).toContain(
          'รูปแบบ counterKey ไม่ถูกต้อง'
        );
      }
      expect(mockManualOverrideService.applyOverride).not.toHaveBeenCalled();
    });

    it('throws ValidationException when a required field is missing', async () => {
      const badToken = JSON.stringify({ projectId: 3 });
      await expect(
        service.overrideCounter(badToken, 10, 1, 'x')
      ).rejects.toThrow(ValidationException);
      expect(mockManualOverrideService.applyOverride).not.toHaveBeenCalled();
    });

    it('throws ValidationException when resetScope is missing', async () => {
      const badToken = JSON.stringify({
        projectId: 3,
        originatorOrganizationId: 42,
        recipientOrganizationId: 22,
        correspondenceTypeId: 1,
        subTypeId: 0,
        rfaTypeId: 0,
        disciplineId: 0,
      });
      await expect(
        service.overrideCounter(badToken, 10, 1, 'x')
      ).rejects.toThrow(ValidationException);
      expect(mockManualOverrideService.applyOverride).not.toHaveBeenCalled();
    });
  });
});
