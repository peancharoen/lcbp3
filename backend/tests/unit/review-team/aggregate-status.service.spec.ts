// File: tests/unit/review-team/aggregate-status.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AggregateStatusService } from '../../../src/modules/review-team/services/aggregate-status.service';
import { ReviewTask } from '../../../src/modules/review-team/entities/review-task.entity';
import {
  ReviewTaskStatus,
  ConsensusDecision,
} from '../../../src/modules/common/enums/review.enums';

describe('AggregateStatusService', () => {
  let service: AggregateStatusService;
  let _taskRepo: Repository<ReviewTask>;

  const mockTaskRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregateStatusService,
        {
          provide: getRepositoryToken(ReviewTask),
          useValue: mockTaskRepo,
        },
      ],
    }).compile();

    service = module.get<AggregateStatusService>(AggregateStatusService);
    _taskRepo = module.get<Repository<ReviewTask>>(
      getRepositoryToken(ReviewTask)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getForRevision', () => {
    it('should return 0 status if no tasks exist', async () => {
      mockTaskRepo.find.mockResolvedValue([]);
      const result = await service.getForRevision(1);
      expect(result.total).toBe(0);
      expect(result.completionPct).toBe(0);
      expect(result.isAllComplete).toBe(false);
    });

    it('should calculate counts correctly', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { status: ReviewTaskStatus.COMPLETED },
        { status: ReviewTaskStatus.COMPLETED },
        { status: ReviewTaskStatus.PENDING },
        { status: ReviewTaskStatus.IN_PROGRESS },
        { status: ReviewTaskStatus.DELEGATED },
        { status: ReviewTaskStatus.EXPIRED },
      ]);

      const result = await service.getForRevision(1);

      expect(result.total).toBe(6);
      expect(result.completed).toBe(2);
      expect(result.pending).toBe(1);
      expect(result.inProgress).toBe(1);
      expect(result.delegated).toBe(1);
      expect(result.expired).toBe(1);
      expect(result.completionPct).toBe(33);
      expect(result.isAllComplete).toBe(false);
      expect(result.hasExpired).toBe(true);
    });

    it('should return isAllComplete true if all tasks are COMPLETED', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { status: ReviewTaskStatus.COMPLETED },
        { status: ReviewTaskStatus.COMPLETED },
      ]);

      const result = await service.getForRevision(1);
      expect(result.isAllComplete).toBe(true);
      expect(result.completionPct).toBe(100);
    });
  });

  describe('isReadyForConsensus', () => {
    it('should return true if all complete', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { status: ReviewTaskStatus.COMPLETED },
      ]);
      expect(await service.isReadyForConsensus(1)).toBe(true);
    });

    it('should return false if not all complete', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { status: ReviewTaskStatus.PENDING },
      ]);
      expect(await service.isReadyForConsensus(1)).toBe(false);
    });
  });

  describe('evaluateConsensus', () => {
    it('should return PENDING if no completed tasks', async () => {
      mockTaskRepo.find.mockResolvedValue([]);
      expect(await service.evaluateConsensus(1)).toBe(
        ConsensusDecision.PENDING
      );
    });

    it('should return REJECTED if any Code 3 exists', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '3' } },
      ]);
      expect(await service.evaluateConsensus(1)).toBe(
        ConsensusDecision.REJECTED
      );
    });

    it('should return APPROVED if all are 1A or 1B', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '1B' } },
      ]);
      expect(await service.evaluateConsensus(1)).toBe(
        ConsensusDecision.APPROVED
      );
    });

    it('should return APPROVED_WITH_COMMENTS if any Code 2 exists and no Code 3', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '2' } },
      ]);
      expect(await service.evaluateConsensus(1)).toBe(
        ConsensusDecision.APPROVED_WITH_COMMENTS
      );
    });
  });

  describe('getMostRestrictiveResponseCode', () => {
    it('should return 1A if no completed tasks', async () => {
      mockTaskRepo.find.mockResolvedValue([]);
      expect(await service.getMostRestrictiveResponseCode(1)).toBe('1A');
    });

    it('should return 3 if any Code 3 exists', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '2' } },
        { responseCode: { code: '3' } },
      ]);
      expect(await service.getMostRestrictiveResponseCode(1)).toBe('3');
    });

    it('should return 2 if Code 2 exists and no Code 3', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '1B' } },
        { responseCode: { code: '2' } },
      ]);
      expect(await service.getMostRestrictiveResponseCode(1)).toBe('2');
    });

    it('should return 1B if Code 1B exists and no Code 2 or 3', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { responseCode: { code: '1A' } },
        { responseCode: { code: '1B' } },
      ]);
      expect(await service.getMostRestrictiveResponseCode(1)).toBe('1B');
    });

    it('should return 1A if only Code 1A exists', async () => {
      mockTaskRepo.find.mockResolvedValue([{ responseCode: { code: '1A' } }]);
      expect(await service.getMostRestrictiveResponseCode(1)).toBe('1A');
    });
  });
});
