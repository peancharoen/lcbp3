// File: tests/unit/delegation/circular-detection.service.spec.ts
// Change Log
// - 2026-05-13: ปรับ mock repository ให้ตรงกับ QueryBuilder contract ของ CircularDetectionService
// Unit tests สำหรับ CircularDetectionService — ป้องกัน delegation loops (T075)
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CircularDetectionService } from '../../../src/modules/delegation/services/circular-detection.service';
import { Delegation } from '../../../src/modules/delegation/entities/delegation.entity';

type DelegationRow = Pick<Delegation, 'delegatorUserId' | 'delegateUserId'>;

type QueryBuilderMock = {
  where: jest.MockedFunction<
    (
      condition: string,
      parameters?: Record<string, unknown>
    ) => QueryBuilderMock
  >;
  andWhere: jest.MockedFunction<
    (
      condition: string,
      parameters?: Record<string, unknown>
    ) => QueryBuilderMock
  >;
  select: jest.MockedFunction<(selection: string[]) => QueryBuilderMock>;
  getMany: jest.MockedFunction<() => Promise<DelegationRow[]>>;
};

type DelegationRepositoryMock = {
  createQueryBuilder: jest.MockedFunction<(alias: string) => QueryBuilderMock>;
};

const createQueryBuilderMock = (
  delegations: DelegationRow[]
): QueryBuilderMock => {
  const queryBuilder = {} as QueryBuilderMock;
  queryBuilder.where = jest.fn(
    (
      _condition: string,
      _parameters?: Record<string, unknown>
    ): QueryBuilderMock => queryBuilder
  );
  queryBuilder.andWhere = jest.fn(
    (
      _condition: string,
      _parameters?: Record<string, unknown>
    ): QueryBuilderMock => queryBuilder
  );
  queryBuilder.select = jest.fn(
    (_selection: string[]): QueryBuilderMock => queryBuilder
  );
  queryBuilder.getMany = jest.fn(
    (): Promise<DelegationRow[]> => Promise.resolve(delegations)
  );
  return queryBuilder;
};

const mockDelegationRepo: DelegationRepositoryMock = {
  createQueryBuilder: jest.fn(),
};

describe('CircularDetectionService', () => {
  let service: CircularDetectionService;

  const mockActiveDelegations = (
    delegations: DelegationRow[]
  ): QueryBuilderMock => {
    const queryBuilder = createQueryBuilderMock(delegations);
    mockDelegationRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    return queryBuilder;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircularDetectionService,
        {
          provide: getRepositoryToken(Delegation),
          useValue: mockDelegationRepo,
        },
      ],
    }).compile();

    service = module.get<CircularDetectionService>(CircularDetectionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('wouldCreateCircle', () => {
    it('should return false when no delegations exist', async () => {
      mockActiveDelegations([]);
      const result = await service.wouldCreateCircle(1, 2);
      expect(result).toBe(false);
    });

    it('should detect direct circular delegation A→B when B→A exists', async () => {
      // B (id=2) delegates to A (id=1)
      mockActiveDelegations([{ delegatorUserId: 2, delegateUserId: 1 }]);
      // Now trying to add A→B — would create cycle
      const result = await service.wouldCreateCircle(1, 2);
      expect(result).toBe(true);
    });

    it('should detect indirect cycle A→B→C when trying C→A', async () => {
      // A→B and B→C already exist
      mockActiveDelegations([
        { delegatorUserId: 1, delegateUserId: 2 },
        { delegatorUserId: 2, delegateUserId: 3 },
      ]);
      // Now trying C→A — would create A→B→C→A cycle
      const result = await service.wouldCreateCircle(3, 1);
      expect(result).toBe(true);
    });

    it('should return false for non-circular delegations', async () => {
      // A→B and B→C — adding D→A is fine
      mockActiveDelegations([
        { delegatorUserId: 1, delegateUserId: 2 },
        { delegatorUserId: 2, delegateUserId: 3 },
      ]);
      const result = await service.wouldCreateCircle(4, 1);
      expect(result).toBe(false);
    });
  });
});
