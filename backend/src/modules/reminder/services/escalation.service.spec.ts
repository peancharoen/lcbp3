// File: src/modules/reminder/services/escalation.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ EscalationService (FR-015, FR-016)

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EscalationService } from './escalation.service';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import {
  ReviewTaskStatus,
  ReminderType,
} from '../../common/enums/review.enums';
import { NotificationService } from '../../notification/notification.service';
import { ReminderRule } from '../entities/reminder-rule.entity';
import { ReminderHistory } from '../entities/reminder-history.entity';
import { UserAssignment } from '../../user/entities/user-assignment.entity';

// Helper สร้าง mock ReviewTask
const makeTask = (
  publicId: string,
  status: ReviewTaskStatus = ReviewTaskStatus.IN_PROGRESS,
  assignedToUserId = 10
): Partial<ReviewTask> => ({
  id: 1,
  publicId,
  status,
  assignedToUserId,
  assignedToUser: {
    firstName: 'John',
    lastName: 'Doe',
  } as ReviewTask['assignedToUser'],
  discipline: { codeNameEn: 'STRUC' } as ReviewTask['discipline'],
  team: {} as ReviewTask['team'],
  dueDate: new Date('2026-01-01'),
});

describe('EscalationService', () => {
  let service: EscalationService;
  let mockTaskRepo: any;
  let mockReminderRuleRepo: any;
  let mockHistoryRepo: any;
  let mockAssignmentRepo: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockTaskRepo = { findOne: jest.fn(), find: jest.fn() };
    mockReminderRuleRepo = { find: jest.fn() };
    mockHistoryRepo = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn(),
      findOne: jest.fn(),
    };
    mockAssignmentRepo = { findOne: jest.fn() };
    mockNotificationService = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: getRepositoryToken(ReviewTask), useValue: mockTaskRepo },
        {
          provide: getRepositoryToken(ReminderRule),
          useValue: mockReminderRuleRepo,
        },
        {
          provide: getRepositoryToken(ReminderHistory),
          useValue: mockHistoryRepo,
        },
        {
          provide: getRepositoryToken(UserAssignment),
          useValue: mockAssignmentRepo,
        },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();
    service = module.get<EscalationService>(EscalationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordHistory', () => {
    it('ควรบันทึก ReminderHistory', async () => {
      const task = makeTask('task-001') as ReviewTask;
      const historyRecord = {
        taskId: 1,
        userId: 10,
        reminderType: ReminderType.ESCALATION_L1,
        escalationLevel: 1,
      };
      mockHistoryRepo.create.mockReturnValueOnce(historyRecord);
      await service.recordHistory(task, ReminderType.ESCALATION_L1, 1);
      expect(mockHistoryRepo.save).toHaveBeenCalledWith(historyRecord);
    });
  });

  describe('getStrikeCount', () => {
    it('ควรนับจำนวน history ตาม taskId และ level', async () => {
      mockHistoryRepo.count.mockResolvedValueOnce(2);
      const count = await service.getStrikeCount(1, 1);
      expect(count).toBe(2);
      expect(mockHistoryRepo.count).toHaveBeenCalledWith({
        where: { taskId: 1, escalationLevel: 1 },
      });
    });
  });

  describe('escalateLevel1', () => {
    it('ควร return ทันทีเมื่อ task ไม่พบ', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(null);
      await service.escalateLevel1('task-none');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร return ทันทีเมื่อ task.status=COMPLETED', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(
        makeTask('task-done', ReviewTaskStatus.COMPLETED)
      );
      await service.escalateLevel1('task-done');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร escalate ไปยัง L2 เมื่อ strikes >= 3', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce(makeTask('task-001')) // L1 call
        .mockResolvedValueOnce(makeTask('task-001')); // L2 call
      mockHistoryRepo.count
        .mockResolvedValueOnce(3) // L1 strikes = 3 → go to L2
        .mockResolvedValueOnce(0); // L2 strikes
      mockAssignmentRepo.findOne.mockResolvedValueOnce(null); // PM ไม่พบ
      mockHistoryRepo.create.mockReturnValue({});
      await service.escalateLevel1('task-001');
      // L2 ถูกเรียก → notification ถูกส่งถึง assignedToUser
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
    });

    it('ควรส่ง L1 notification และบันทึก history เมื่อ strikes < 3', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(makeTask('task-001'));
      mockHistoryRepo.count.mockResolvedValueOnce(1); // strikes=1
      mockHistoryRepo.create.mockReturnValueOnce({});
      await service.escalateLevel1('task-001');
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          type: 'SYSTEM',
          entityType: 'review_task',
        })
      );
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });

    it('ควรไม่ส่ง notification เมื่อ assignedToUserId เป็น null', async () => {
      const task = makeTask('task-001', ReviewTaskStatus.IN_PROGRESS);
      task.assignedToUserId = null as any;
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockHistoryRepo.count.mockResolvedValueOnce(0);
      await service.escalateLevel1('task-001');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });
  });

  describe('escalateLevel2', () => {
    it('ควร return ทันทีเมื่อ task ไม่พบ', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(null);
      await service.escalateLevel2('task-none');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร return ทันทีเมื่อ task.status=COMPLETED', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(
        makeTask('task-done', ReviewTaskStatus.COMPLETED)
      );
      await service.escalateLevel2('task-done');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควรส่งแจ้งเตือนถึง PM และ assignee (2 calls)', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce(makeTask('task-001'))
        .mockResolvedValueOnce({
          // full task with relations
          rfaRevision: {
            correspondenceRevision: {
              correspondence: { projectId: 5 },
            },
          },
        });
      mockHistoryRepo.count.mockResolvedValueOnce(0);
      mockAssignmentRepo.findOne.mockResolvedValueOnce({ userId: 99 }); // PM
      mockHistoryRepo.create.mockReturnValue({});
      await service.escalateLevel2('task-001');
      expect(mockNotificationService.send).toHaveBeenCalledTimes(2); // PM + assignee
      const calls = mockNotificationService.send.mock.calls;
      expect(calls[0][0].userId).toBe(99); // PM
      expect(calls[1][0].userId).toBe(10); // assignee
    });

    it('ควรส่งแจ้งเตือนถึง assignee เท่านั้น เมื่อหา PM ไม่เจอ', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce(makeTask('task-002'))
        .mockResolvedValueOnce({ rfaRevision: null }); // ไม่มี correspondence
      mockHistoryRepo.count.mockResolvedValueOnce(0);
      mockAssignmentRepo.findOne.mockResolvedValueOnce(null); // PM ไม่พบ
      mockHistoryRepo.create.mockReturnValue({});
      await service.escalateLevel2('task-002');
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1); // assignee only
    });
  });

  describe('processOverdueTasks', () => {
    it('ควรไม่ทำอะไรเมื่อไม่มี overdue tasks', async () => {
      mockTaskRepo.find.mockResolvedValueOnce([]);
      await service.processOverdueTasks();
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร escalateLevel1 เมื่อ task ไม่มี history ก่อนหน้า', async () => {
      const task = makeTask('task-new');
      mockTaskRepo.find.mockResolvedValueOnce([task]);
      mockHistoryRepo.findOne.mockResolvedValueOnce(null); // ไม่มี history
      // escalateLevel1 mock:
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockHistoryRepo.count.mockResolvedValueOnce(0);
      mockHistoryRepo.create.mockReturnValue({});
      await service.processOverdueTasks();
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
    });

    it('ควร escalateLevel2 เมื่อ last history level=1 และ strikes >= 3', async () => {
      const task = makeTask('task-l2');
      mockTaskRepo.find.mockResolvedValueOnce([task]);
      mockHistoryRepo.findOne.mockResolvedValueOnce({ escalationLevel: 1 });
      mockHistoryRepo.count.mockResolvedValueOnce(3); // strikes for level 1 = 3
      // escalateLevel2 mock:
      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ rfaRevision: null });
      mockHistoryRepo.count.mockResolvedValueOnce(0); // L2 strikes
      mockAssignmentRepo.findOne.mockResolvedValueOnce(null);
      mockHistoryRepo.create.mockReturnValue({});
      await service.processOverdueTasks();
      // assignee notification
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
    });

    it('ควร re-escalateLevel1 เมื่อ last history level=1 แต่ strikes < 3', async () => {
      const task = makeTask('task-l1-again');
      mockTaskRepo.find.mockResolvedValueOnce([task]);
      mockHistoryRepo.findOne.mockResolvedValueOnce({ escalationLevel: 1 });
      mockHistoryRepo.count.mockResolvedValueOnce(1); // strikes=1 < 3
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockHistoryRepo.count.mockResolvedValueOnce(1); // L1 strikes again
      mockHistoryRepo.create.mockReturnValue({});
      await service.processOverdueTasks();
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1); // L1 notification
    });

    it('ควร escalateLevel2 รายวัน เมื่อ last history level=2', async () => {
      const task = makeTask('task-daily-l2');
      mockTaskRepo.find.mockResolvedValueOnce([task]);
      mockHistoryRepo.findOne.mockResolvedValueOnce({ escalationLevel: 2 });
      // escalateLevel2:
      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ rfaRevision: null });
      mockHistoryRepo.count.mockResolvedValueOnce(2); // L2 strike
      mockAssignmentRepo.findOne.mockResolvedValueOnce(null);
      mockHistoryRepo.create.mockReturnValue({});
      await service.processOverdueTasks();
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
    });
  });
});
