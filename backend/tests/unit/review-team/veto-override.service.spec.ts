// File: tests/unit/review-team/veto-override.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  VetoOverrideService,
  VetoOverrideDto,
} from '../../../src/modules/review-team/services/veto-override.service';
import { ReviewTask } from '../../../src/modules/review-team/entities/review-task.entity';
import { ApprovalListenerService } from '../../../src/modules/distribution/services/approval-listener.service';
import { ConsensusDecision } from '../../../src/modules/common/enums/review.enums';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('VetoOverrideService', () => {
  let service: VetoOverrideService;
  let _taskRepo: Repository<ReviewTask>;
  let approvalListenerService: ApprovalListenerService;

  const mockTaskRepo = {
    find: jest.fn(),
  };

  const mockApprovalListenerService = {
    onConsensusReached: jest.fn(),
  };

  const mockDataSource = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VetoOverrideService,
        {
          provide: getRepositoryToken(ReviewTask),
          useValue: mockTaskRepo,
        },
        {
          provide: ApprovalListenerService,
          useValue: mockApprovalListenerService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<VetoOverrideService>(VetoOverrideService);
    _taskRepo = module.get<Repository<ReviewTask>>(
      getRepositoryToken(ReviewTask)
    );
    approvalListenerService = module.get<ApprovalListenerService>(
      ApprovalListenerService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeOverride', () => {
    const validDto: VetoOverrideDto = {
      rfaRevisionId: 1,
      rfaPublicId: 'rfa-uuid',
      rfaRevisionPublicId: 'rev-uuid',
      projectId: 10,
      documentTypeCode: 'SD',
      overrideReason: 'This is a valid justification for override.',
      overriddenByUserId: 1,
    };

    it('should throw NotFoundException if no tasks found', async () => {
      mockTaskRepo.find.mockResolvedValue([]);
      await expect(service.executeOverride(validDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if no Code 3 veto found', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { id: 1, responseCode: { code: '1A' } },
        { id: 2, responseCode: { code: '2' } },
      ]);
      await expect(service.executeOverride(validDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException if reason is too short', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { id: 1, responseCode: { code: '3' } },
      ]);
      const shortDto = { ...validDto, overrideReason: 'Too short' };
      await expect(service.executeOverride(shortDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should successfully execute override and call approval listener', async () => {
      mockTaskRepo.find.mockResolvedValue([
        { id: 1, responseCode: { code: '3' } },
      ]);

      const result = await service.executeOverride(validDto);

      expect(result.decision).toBe(ConsensusDecision.OVERRIDDEN);
      expect(approvalListenerService.onConsensusReached).toHaveBeenCalledWith(
        expect.objectContaining({
          rfaPublicId: validDto.rfaPublicId,
          decision: ConsensusDecision.OVERRIDDEN,
          responseCode: '1A',
        })
      );
    });
  });
});
