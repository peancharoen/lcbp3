// File: src/modules/review-team/services/task-creation.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ TaskCreationService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TaskCreationService } from './task-creation.service';
import { ReviewTeam } from '../entities/review-team.entity';
import { ReviewTeamMember } from '../entities/review-team-member.entity';
import { ReviewTask } from '../entities/review-task.entity';
import { DelegationService } from '../../delegation/delegation.service';
import { SchedulerService } from '../../reminder/services/scheduler.service';
import {
  ReviewTeamMemberRole,
  ReviewTaskStatus,
  ReminderType,
} from '../../common/enums/review.enums';

describe('TaskCreationService', () => {
  let service: TaskCreationService;
  let mockReviewTeamRepo: Record<string, jest.Mock>;
  let mockMemberRepo: Record<string, jest.Mock>;
  let mockReviewTaskRepo: Record<string, jest.Mock>;
  let mockDelegationService: Record<string, jest.Mock>;
  let mockSchedulerService: Record<string, jest.Mock>;
  let mockEntityManager: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockReviewTeamRepo = {
      findOne: jest.fn(),
    };
    mockMemberRepo = {};
    mockReviewTaskRepo = {
      find: jest.fn(),
    };
    mockDelegationService = {
      findActiveDelegate: jest.fn(),
    };
    mockSchedulerService = {
      scheduleForTask: jest.fn(),
    };
    mockEntityManager = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCreationService,
        {
          provide: getRepositoryToken(ReviewTeam),
          useValue: mockReviewTeamRepo,
        },
        {
          provide: getRepositoryToken(ReviewTeamMember),
          useValue: mockMemberRepo,
        },
        {
          provide: getRepositoryToken(ReviewTask),
          useValue: mockReviewTaskRepo,
        },
        {
          provide: DelegationService,
          useValue: mockDelegationService,
        },
        {
          provide: SchedulerService,
          useValue: mockSchedulerService,
        },
      ],
    }).compile();
    service = module.get<TaskCreationService>(TaskCreationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createParallelTasks', () => {
    const mockDueDate = new Date();
    const rfaRevisionId = 100;
    const rfaPublicId = 'rfa-uuid-001';
    const reviewTeamPublicId = 'team-uuid-001';

    it('ควรคืนค่า empty array เมื่อไม่พบ ReviewTeam', async () => {
      mockReviewTeamRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createParallelTasks(
        rfaRevisionId,
        rfaPublicId,
        reviewTeamPublicId,
        mockDueDate,
        mockEntityManager as unknown as EntityManager
      );
      expect(result).toEqual([]);
      expect(mockReviewTeamRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: reviewTeamPublicId },
        relations: ['members'],
      });
    });

    it('ควรคืนค่า empty array เมื่อ ReviewTeam is_active=false', async () => {
      mockReviewTeamRepo.findOne.mockResolvedValueOnce({
        id: 1,
        publicId: reviewTeamPublicId,
        isActive: false,
      });
      const result = await service.createParallelTasks(
        rfaRevisionId,
        rfaPublicId,
        reviewTeamPublicId,
        mockDueDate,
        mockEntityManager as unknown as EntityManager
      );
      expect(result).toEqual([]);
    });

    it('ควรคืนค่า empty array เมื่อ ReviewTeam ไม่มี members', async () => {
      mockReviewTeamRepo.findOne.mockResolvedValueOnce({
        id: 1,
        publicId: reviewTeamPublicId,
        isActive: true,
        members: [],
      });
      const result = await service.createParallelTasks(
        rfaRevisionId,
        rfaPublicId,
        reviewTeamPublicId,
        mockDueDate,
        mockEntityManager as unknown as EntityManager
      );
      expect(result).toEqual([]);
    });

    it('ควรสร้าง parallel review tasks ตาม disciplines และกรองลำดับ LEAD/REVIEWER (Happy Path)', async () => {
      const mockMembers: Partial<ReviewTeamMember>[] = [
        {
          id: 10,
          userId: 1,
          disciplineId: 101,
          role: ReviewTeamMemberRole.REVIEWER,
        },
        {
          id: 11,
          userId: 2,
          disciplineId: 101,
          role: ReviewTeamMemberRole.LEAD,
        },
        {
          id: 12,
          userId: 3,
          disciplineId: 102,
          role: ReviewTeamMemberRole.REVIEWER,
        },
      ];
      mockReviewTeamRepo.findOne.mockResolvedValueOnce({
        id: 5,
        projectId: 50,
        publicId: reviewTeamPublicId,
        isActive: true,
        members: mockMembers as ReviewTeamMember[],
      });
      mockDelegationService.findActiveDelegate.mockResolvedValue(null);
      const createdTask1: Partial<ReviewTask> = {
        id: 201,
        publicId: 'task-uuid-201',
        rfaRevisionId,
        teamId: 5,
        disciplineId: 101,
        assignedToUserId: 2, // หยิบคนที่เป็น LEAD ใน discipline 101
        status: ReviewTaskStatus.PENDING,
        dueDate: mockDueDate,
      };
      const createdTask2: Partial<ReviewTask> = {
        id: 202,
        publicId: 'task-uuid-202',
        rfaRevisionId,
        teamId: 5,
        disciplineId: 102,
        assignedToUserId: 3,
        status: ReviewTaskStatus.PENDING,
        dueDate: mockDueDate,
      };
      mockEntityManager.create
        .mockReturnValueOnce(createdTask1)
        .mockReturnValueOnce(createdTask2);
      mockEntityManager.save
        .mockResolvedValueOnce(createdTask1)
        .mockResolvedValueOnce(createdTask2);
      const result = await service.createParallelTasks(
        rfaRevisionId,
        rfaPublicId,
        reviewTeamPublicId,
        mockDueDate,
        mockEntityManager as unknown as EntityManager,
        50,
        'SDW'
      );
      expect(result).toHaveLength(2);
      expect(mockEntityManager.create).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2);
      expect(mockSchedulerService.scheduleForTask).toHaveBeenCalledTimes(2);
      expect(mockSchedulerService.scheduleForTask).toHaveBeenNthCalledWith(1, {
        taskPublicId: 'task-uuid-201',
        rfaPublicId: rfaPublicId,
        assigneeUserId: 2,
        dueDate: mockDueDate,
        reminderType: ReminderType.DUE_SOON,
        projectId: 50,
        documentTypeCode: 'SDW',
      });
    });

    it('ควรดึงข้อมูล delegation เมื่อสมาชิกคนนั้นมี active delegate และเซ็ต assignedToUserId เป็นผู้รับมอบสิทธิ์', async () => {
      const mockMembers: Partial<ReviewTeamMember>[] = [
        {
          id: 10,
          userId: 1,
          disciplineId: 101,
          role: ReviewTeamMemberRole.LEAD,
        },
      ];
      mockReviewTeamRepo.findOne.mockResolvedValueOnce({
        id: 5,
        projectId: 50,
        publicId: reviewTeamPublicId,
        isActive: true,
        members: mockMembers as ReviewTeamMember[],
      });
      mockDelegationService.findActiveDelegate.mockResolvedValueOnce({
        user_id: 99,
      });
      const createdTask: Partial<ReviewTask> = {
        id: 201,
        publicId: 'task-uuid-201',
        rfaRevisionId,
        teamId: 5,
        disciplineId: 101,
        assignedToUserId: 99,
        delegatedFromUserId: 1,
        status: ReviewTaskStatus.PENDING,
        dueDate: mockDueDate,
      };
      mockEntityManager.create.mockReturnValueOnce(createdTask);
      mockEntityManager.save.mockResolvedValueOnce(createdTask);
      const result = await service.createParallelTasks(
        rfaRevisionId,
        rfaPublicId,
        reviewTeamPublicId,
        mockDueDate,
        mockEntityManager as unknown as EntityManager
      );
      expect(result).toHaveLength(1);
      expect(result[0].assignedToUserId).toBe(99);
      expect(mockDelegationService.findActiveDelegate).toHaveBeenCalledWith(
        1,
        mockDueDate,
        expect.arrayContaining(['ALL', 'RFA_ONLY'])
      );
    });
  });

  describe('areAllTasksCompleted', () => {
    const rfaRevisionId = 100;

    it('ควรคืนค่า false เมื่อไม่มี review tasks ในระบบสำหรับ revision นั้น', async () => {
      mockReviewTaskRepo.find.mockResolvedValueOnce([]);
      const result = await service.areAllTasksCompleted(rfaRevisionId);
      expect(result).toBe(false);
      expect(mockReviewTaskRepo.find).toHaveBeenCalledWith({
        where: { rfaRevisionId },
      });
    });

    it('ควรคืนค่า false เมื่อบาง task ยังมีสถานะ PENDING', async () => {
      const mockTasks: Partial<ReviewTask>[] = [
        { id: 1, status: ReviewTaskStatus.COMPLETED },
        { id: 2, status: ReviewTaskStatus.PENDING },
      ];
      mockReviewTaskRepo.find.mockResolvedValueOnce(mockTasks as ReviewTask[]);
      const result = await service.areAllTasksCompleted(rfaRevisionId);
      expect(result).toBe(false);
    });

    it('ควรคืนค่า true เมื่อทุก tasks มีสถานะ COMPLETED หรือ CANCELLED', async () => {
      const mockTasks: Partial<ReviewTask>[] = [
        { id: 1, status: ReviewTaskStatus.COMPLETED },
        { id: 2, status: ReviewTaskStatus.CANCELLED },
      ];
      mockReviewTaskRepo.find.mockResolvedValueOnce(mockTasks as ReviewTask[]);
      const result = await service.areAllTasksCompleted(rfaRevisionId);
      expect(result).toBe(true);
    });
  });
});
