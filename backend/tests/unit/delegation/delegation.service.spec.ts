// File: tests/unit/delegation/delegation.service.spec.ts
// Change Log
// - 2026-05-13: เพิ่ม regression test เพื่อป้องกัน multi-level delegation chain
import { DelegationService } from '../../../src/modules/delegation/delegation.service';
import { CircularDetectionService } from '../../../src/modules/delegation/services/circular-detection.service';
import { Delegation } from '../../../src/modules/delegation/entities/delegation.entity';
import { User } from '../../../src/modules/user/entities/user.entity';
import { DelegationScope } from '../../../src/modules/common/enums/review.enums';
import { Repository } from 'typeorm';

type RepositoryMock<T extends object> = {
  findOne: jest.MockedFunction<(options: unknown) => Promise<T | null>>;
  create: jest.MockedFunction<(payload: Partial<T>) => T>;
  save: jest.MockedFunction<(entity: T) => Promise<T>>;
  createQueryBuilder: jest.MockedFunction<(alias: string) => QueryBuilderMock>;
};

type QueryBuilderMock = {
  innerJoinAndSelect: jest.MockedFunction<
    (relation: string, alias: string) => QueryBuilderMock
  >;
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
  orderBy: jest.MockedFunction<
    (sort: string, order: 'ASC' | 'DESC') => QueryBuilderMock
  >;
  getOne: jest.MockedFunction<() => Promise<Delegation | null>>;
};

const createQueryBuilderMock = (
  delegation: Delegation | null
): QueryBuilderMock => {
  const queryBuilder = {} as QueryBuilderMock;
  queryBuilder.innerJoinAndSelect = jest.fn(
    (_relation: string, _alias: string): QueryBuilderMock => queryBuilder
  );
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
  queryBuilder.orderBy = jest.fn(
    (_sort: string, _order: 'ASC' | 'DESC'): QueryBuilderMock => queryBuilder
  );
  queryBuilder.getOne = jest.fn(
    (): Promise<Delegation | null> => Promise.resolve(delegation)
  );
  return queryBuilder;
};

const createRepositoryMock = <T extends object>(): RepositoryMock<T> => ({
  findOne: jest.fn(),
  create: jest.fn((payload: Partial<T>): T => payload as T),
  save: jest.fn((entity: T): Promise<T> => Promise.resolve(entity)),
  createQueryBuilder: jest.fn(),
});

describe('DelegationService', () => {
  const delegationRepo = createRepositoryMock<Delegation>();
  const userRepo = createRepositoryMock<User>();
  const circularDetectionService = {
    wouldCreateCircle: jest.fn(),
  } as unknown as CircularDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    delegationRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(null)
    );
    (circularDetectionService.wouldCreateCircle as jest.Mock).mockResolvedValue(
      false
    );
  });

  it('rejects delegated user who already delegates onward', async () => {
    const service = new DelegationService(
      delegationRepo as unknown as Repository<Delegation>,
      userRepo as unknown as Repository<User>,
      circularDetectionService
    );
    const delegator = {
      user_id: 1,
      publicId: '019505a1-7c3e-7000-8000-000000000001',
    } as User;
    const delegate = {
      user_id: 2,
      publicId: '019505a1-7c3e-7000-8000-000000000002',
    } as User;
    const onwardDelegation = {
      publicId: '019505a1-7c3e-7000-8000-000000000003',
      delegatorUserId: delegate.user_id,
      delegateUserId: 3,
      delegate: { user_id: 3 } as User,
    } as Delegation;

    (userRepo.findOne as jest.Mock)
      .mockResolvedValueOnce(delegator)
      .mockResolvedValueOnce(delegate);
    delegationRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(onwardDelegation)
    );

    await expect(
      service.create(delegator.publicId, {
        delegateUserPublicId: delegate.publicId,
        scope: DelegationScope.RFA_ONLY,
        startDate: new Date('2026-05-20T00:00:00.000Z'),
        endDate: new Date('2026-05-27T00:00:00.000Z'),
      })
    ).rejects.toThrow('Nested delegation is not allowed');
  });
});
