// File: src/modules/review-team/review-task.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ReviewTaskService (FR-004, FR-009, T069)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ReviewTaskService } from './review-task.service';
import { ReviewTask } from './entities/review-task.entity';
import { ResponseCode } from '../response-code/entities/response-code.entity';
import { ResponseCodeAuditService } from '../response-code/services/audit.service';
import {
  CompleteReviewTaskDto,
  SearchReviewTaskDto,
} from './dto/shared/review-team.dto';
import { ReviewTaskStatus } from '../common/enums/review.enums';

describe('ReviewTaskService', () => {
  let service: ReviewTaskService;

  const mockReviewTaskRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockResponseCodeRepo = {
    findOne: jest.fn(),
  };
  const mockAuditService = {
    logReviewTaskResponseCodeChange: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewTaskService,
        {
          provide: getRepositoryToken(ReviewTask),
          useValue: mockReviewTaskRepo,
        },
        {
          provide: getRepositoryToken(ResponseCode),
          useValue: mockResponseCodeRepo,
        },
        {
          provide: ResponseCodeAuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<ReviewTaskService>(ReviewTaskService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByRevisionId', () => {
    it('ควรคืน tasks ตาม rfaRevisionId', async () => {
      const tasks: Partial<ReviewTask>[] = [{ id: 1, rfaRevisionId: 5 }];
      mockReviewTaskRepo.find.mockResolvedValue(tasks);

      const result = await service.findByRevisionId(5);

      expect(mockReviewTaskRepo.find).toHaveBeenCalledWith({
        where: { rfaRevisionId: 5 },
      });
      expect(result).toEqual(tasks);
    });
  });

  describe('findAll', () => {
    const mockQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    it('ควรคืน tasks ทั้งหมดโดยไม่มี filter', async () => {
      const tasks = [{ id: 1 }];
      mockQB.getMany.mockResolvedValue(tasks);
      mockReviewTaskRepo.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.findAll({});

      expect(result).toEqual(tasks);
    });

    it('ควรกรองด้วย rfaRevisionPublicId', async () => {
      mockQB.getMany.mockResolvedValue([]);
      mockReviewTaskRepo.createQueryBuilder.mockReturnValue(mockQB);

      const dto: SearchReviewTaskDto = {
        rfaRevisionPublicId: 'uuid-rev-1',
      };

      await service.findAll(dto);

      expect(mockQB.innerJoin).toHaveBeenCalledWith(
        'rfa_revisions',
        'rev',
        'rev.id = task.rfa_revision_id'
      );
      expect(mockQB.where).toHaveBeenCalledWith('rev.uuid = :uuid', {
        uuid: 'uuid-rev-1',
      });
    });

    it('ควรกรองด้วย status, assignedToUserPublicId, dueDateFrom, dueDateTo', async () => {
      mockQB.getMany.mockResolvedValue([]);
      mockReviewTaskRepo.createQueryBuilder.mockReturnValue(mockQB);

      const dto: SearchReviewTaskDto = {
        status: ReviewTaskStatus.PENDING,
        assignedToUserPublicId: 'uuid-user-1',
        dueDateFrom: '2026-01-01',
        dueDateTo: '2026-12-31',
      };

      await service.findAll(dto);

      expect(mockQB.andWhere).toHaveBeenCalledWith('task.status = :status', {
        status: ReviewTaskStatus.PENDING,
      });
      expect(mockQB.andWhere).toHaveBeenCalledWith('user.uuid = :userUuid', {
        userUuid: 'uuid-user-1',
      });
      expect(mockQB.andWhere).toHaveBeenCalledWith('task.due_date >= :from', {
        from: '2026-01-01',
      });
      expect(mockQB.andWhere).toHaveBeenCalledWith('task.due_date <= :to', {
        to: '2026-12-31',
      });
    });
  });

  describe('findByPublicId', () => {
    it('ควรคืน task ตาม publicId', async () => {
      const task = { id: 1, publicId: 'uuid-001' };
      mockReviewTaskRepo.findOne.mockResolvedValue(task);

      const result = await service.findByPublicId('uuid-001');

      expect(result).toEqual(task);
      expect(mockReviewTaskRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-001' },
        relations: ['discipline', 'assignedToUser', 'responseCode', 'team'],
      });
    });

    it('ควร throw NotFoundException เมื่อไม่พบ', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue(null);

      await expect(service.findByPublicId('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findFullTaskContext', () => {
    const mockQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndMapOne: jest.fn().mockReturnThis(),
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    it('ควรคืน task พร้อม context', async () => {
      const task = { id: 1, publicId: 'uuid-001', rfaRevision: {} };
      mockQB.getOne.mockResolvedValue(task);
      mockReviewTaskRepo.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.findFullTaskContext('uuid-001');

      expect(result).toEqual(task);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ', async () => {
      mockQB.getOne.mockResolvedValue(null);
      mockReviewTaskRepo.createQueryBuilder.mockReturnValue(mockQB);

      await expect(service.findFullTaskContext('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getAggregateStatus', () => {
    it('ควรคำนวณ aggregate status ได้', async () => {
      const tasks: Partial<ReviewTask>[] = [
        { status: ReviewTaskStatus.COMPLETED },
        { status: ReviewTaskStatus.CANCELLED },
        { status: ReviewTaskStatus.PENDING },
        { status: ReviewTaskStatus.IN_PROGRESS },
      ];
      mockReviewTaskRepo.find.mockResolvedValue(tasks);

      const result = await service.getAggregateStatus(5);

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.pending).toBe(2);
      expect(result.summary).toBe('2 of 4 Disciplines Reviewed');
    });

    it('ควรคืน 0 เมื่อไม่มี tasks', async () => {
      mockReviewTaskRepo.find.mockResolvedValue([]);

      const result = await service.getAggregateStatus(5);

      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.pending).toBe(0);
    });
  });

  describe('startReview', () => {
    it('ควรเปลี่ยน status จาก PENDING → IN_PROGRESS', async () => {
      const task = {
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.PENDING,
      };
      mockReviewTaskRepo.findOne.mockResolvedValue(task);
      mockReviewTaskRepo.save.mockResolvedValue({
        ...task,
        status: ReviewTaskStatus.IN_PROGRESS,
      });

      const result = await service.startReview('uuid-001');

      expect(result.status).toBe(ReviewTaskStatus.IN_PROGRESS);
    });

    it('ควร throw BadRequestException เมื่อ status ไม่ใช่ PENDING', async () => {
      const task = {
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.COMPLETED,
      };
      mockReviewTaskRepo.findOne.mockResolvedValue(task);

      await expect(service.startReview('uuid-001')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('completeReview', () => {
    const dto: CompleteReviewTaskDto = {
      responseCodePublicId: 'uuid-rc-1',
      comments: 'Approved',
    };

    it('ควร complete review และ log audit', async () => {
      const task = {
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.IN_PROGRESS,
        responseCodeId: undefined,
      };
      mockReviewTaskRepo.findOne.mockResolvedValue(task);
      const responseCode = { id: 10, publicId: 'uuid-rc-1' };
      mockResponseCodeRepo.findOne.mockResolvedValue(responseCode);
      const savedTask = {
        ...task,
        status: ReviewTaskStatus.COMPLETED,
        responseCodeId: 10,
        publicId: 'uuid-001',
      };
      mockReviewTaskRepo.save.mockResolvedValue(savedTask);

      const result = await service.completeReview('uuid-001', dto);

      expect(result.status).toBe(ReviewTaskStatus.COMPLETED);
      expect(result.responseCodeId).toBe(10);
      expect(
        mockAuditService.logReviewTaskResponseCodeChange
      ).toHaveBeenCalledWith({
        reviewTaskPublicId: 'uuid-001',
        responseCodePublicId: 'uuid-rc-1',
        previousResponseCodeId: undefined,
        currentResponseCodeId: 10,
        comments: 'Approved',
      });
    });

    it('ควร throw BadRequestException เมื่อ task  Completed แล้ว', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.COMPLETED,
      });

      await expect(service.completeReview('uuid-001', dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควร throw BadRequestException เมื่อ task Cancelled แล้ว', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.CANCELLED,
      });

      await expect(service.completeReview('uuid-001', dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควร throw NotFoundException เมื่อไม่พบ response code', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.PENDING,
      });
      mockResponseCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.completeReview('uuid-001', dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw ConflictException เมื่อเกิด optimistic lock error', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.PENDING,
      });
      mockResponseCodeRepo.findOne.mockResolvedValue({
        id: 10,
        publicId: 'uuid-rc-1',
      });
      mockReviewTaskRepo.save.mockRejectedValue(
        new Error('OptimisticLock version mismatch')
      );

      await expect(service.completeReview('uuid-001', dto)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควร rethrow error ที่ไม่ใช่ optimistic lock', async () => {
      mockReviewTaskRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-001',
        status: ReviewTaskStatus.PENDING,
      });
      mockResponseCodeRepo.findOne.mockResolvedValue({
        id: 10,
        publicId: 'uuid-rc-1',
      });
      mockReviewTaskRepo.save.mockRejectedValue(new Error('DB connection'));

      await expect(service.completeReview('uuid-001', dto)).rejects.toThrow(
        'DB connection'
      );
    });
  });
});
