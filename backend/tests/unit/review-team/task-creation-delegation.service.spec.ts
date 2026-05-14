// File: tests/unit/review-team/task-creation-delegation.service.spec.ts
// Change Log
// - 2026-05-13: เพิ่ม regression test สำหรับการมอบหมาย Review Task ผ่าน Delegation
import { EntityManager, Repository } from 'typeorm';
import { TaskCreationService } from '../../../src/modules/review-team/services/task-creation.service';
import { ReviewTeam } from '../../../src/modules/review-team/entities/review-team.entity';
import { ReviewTeamMember } from '../../../src/modules/review-team/entities/review-team-member.entity';
import { ReviewTask } from '../../../src/modules/review-team/entities/review-task.entity';
import { DelegationService } from '../../../src/modules/delegation/delegation.service';
import { SchedulerService } from '../../../src/modules/reminder/services/scheduler.service';
import {
  DelegationScope,
  ReviewTeamMemberRole,
} from '../../../src/modules/common/enums/review.enums';
import { User } from '../../../src/modules/user/entities/user.entity';

type RepositoryMock<T extends object> = Pick<Repository<T>, 'findOne' | 'find'>;

const createRepositoryMock = <T extends object>(): jest.Mocked<
  RepositoryMock<T>
> => ({
  findOne: jest.fn(),
  find: jest.fn(),
});

const createManagerMock = (): { create: jest.Mock; save: jest.Mock } => ({
  create: jest.fn(
    (_entity: unknown, payload: Partial<ReviewTask>): ReviewTask =>
      payload as ReviewTask
  ),
  save: jest.fn(
    (_entity: unknown, payload: ReviewTask): Promise<ReviewTask> =>
      Promise.resolve(payload)
  ),
});

describe('TaskCreationService delegation resolution', () => {
  const reviewTeamRepo = createRepositoryMock<ReviewTeam>();
  const memberRepo = createRepositoryMock<ReviewTeamMember>();
  const reviewTaskRepo = createRepositoryMock<ReviewTask>();

  const delegationService = {
    findActiveDelegate: jest.fn(),
  } as unknown as DelegationService;

  const schedulerService = {
    scheduleForTask: jest.fn(),
  } as unknown as SchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns delegated review task to active delegate and preserves original reviewer', async () => {
    const service = new TaskCreationService(
      reviewTeamRepo as unknown as Repository<ReviewTeam>,
      memberRepo as unknown as Repository<ReviewTeamMember>,
      reviewTaskRepo as unknown as Repository<ReviewTask>,
      delegationService,
      schedulerService
    );
    const manager = createManagerMock();
    const originalReviewerId = 10;
    const delegateReviewer = { user_id: 20 } as User;
    const team = {
      id: 1,
      publicId: '019505a1-7c3e-7000-8000-000000000001',
      isActive: true,
      members: [
        {
          userId: originalReviewerId,
          disciplineId: 3,
          role: ReviewTeamMemberRole.LEAD,
        },
      ],
    } as ReviewTeam;

    (reviewTeamRepo.findOne as jest.Mock).mockResolvedValue(team);
    (delegationService.findActiveDelegate as jest.Mock).mockResolvedValue(
      delegateReviewer
    );

    const tasks = await service.createParallelTasks(
      100,
      team.publicId,
      new Date('2026-05-20T00:00:00.000Z'),
      manager as unknown as EntityManager
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0].assignedToUserId).toBe(delegateReviewer.user_id);
    expect(tasks[0].delegatedFromUserId).toBe(originalReviewerId);
    expect(delegationService.findActiveDelegate).toHaveBeenCalledWith(
      originalReviewerId,
      expect.any(Date),
      [DelegationScope.ALL, DelegationScope.RFA_ONLY]
    );
    expect(schedulerService.scheduleForTask).toHaveBeenCalled();
  });
});
