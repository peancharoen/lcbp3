// File: backend/src/modules/dashboard/dashboard.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ DashboardService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { WorkflowInstance } from '../workflow-engine/entities/workflow-instance.entity';
import { Project } from '../project/entities/project.entity';
import { UserAssignment } from '../user/entities/user-assignment.entity';
import { NotFoundException } from '../../common/exceptions';

/**
 * Helper สร้าง mock QueryBuilder ที่ support chaining
 */
function createMockQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('DashboardService', () => {
  let service: DashboardService;
  let mockCorrespondenceRepo: Record<string, jest.Mock>;
  let mockAuditLogRepo: Record<string, jest.Mock>;
  let mockWorkflowInstanceRepo: Record<string, jest.Mock>;
  let mockProjectRepo: Record<string, jest.Mock>;
  let mockUserAssignmentRepo: Record<string, jest.Mock>;
  let mockDataSource: { query: jest.Mock };

  beforeEach(async () => {
    mockCorrespondenceRepo = {
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };
    mockAuditLogRepo = {
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };
    mockWorkflowInstanceRepo = {
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };
    mockProjectRepo = {
      findOne: jest.fn(),
    };
    mockUserAssignmentRepo = {
      findOne: jest.fn(),
    };
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Correspondence),
          useValue: mockCorrespondenceRepo,
        },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        {
          provide: getRepositoryToken(WorkflowInstance),
          useValue: mockWorkflowInstanceRepo,
        },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        {
          provide: getRepositoryToken(UserAssignment),
          useValue: mockUserAssignmentRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return global stats when no projectId', async () => {
      // Setup: correspondence queryBuilder getCount returns 5
      const corrQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(5),
      });
      mockCorrespondenceRepo.createQueryBuilder.mockReturnValue(corrQb);

      // workflowInstance queryBuilder getCount returns 3
      const wfQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(3),
      });
      mockWorkflowInstanceRepo.createQueryBuilder.mockReturnValue(wfQb);

      // dataSource.query mock สำหรับ rfa, circulations, approved
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '10' }]) // rfa
        .mockResolvedValueOnce([{ count: '8' }]) // circulations
        .mockResolvedValueOnce([{ count: '20' }]); // approved

      const result = await service.getStats(1, {});

      expect(result.totalDocuments).toBe(5);
      expect(result.pendingApprovals).toBe(3);
      expect(result.totalRfas).toBe(10);
      expect(result.totalCirculations).toBe(8);
      expect(result.approved).toBe(20);
      expect(result.documentsThisMonth).toBe(5);
    });

    it('should check project access when projectId is provided', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ id: 42 });
      mockUserAssignmentRepo.findOne
        .mockResolvedValueOnce({ userId: 1, projectId: 42 }) // assignment
        .mockResolvedValueOnce(null); // global admin check

      const corrQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(5),
        where: jest.fn().mockReturnThis(),
      });
      mockCorrespondenceRepo.createQueryBuilder.mockReturnValue(corrQb);

      const wfQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(2),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      });
      mockWorkflowInstanceRepo.createQueryBuilder.mockReturnValue(wfQb);

      mockDataSource.query
        .mockResolvedValueOnce([{ count: '3' }])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ count: '7' }]);

      const result = await service.getStats(1, { projectId: 'uuid-123' });

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-123' },
        select: ['id'],
      });
      expect(result.totalDocuments).toBe(5);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getStats(1, { projectId: 'nonexistent' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw PermissionException when user has no assignment', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ id: 42 });
      mockUserAssignmentRepo.findOne
        .mockResolvedValueOnce(null) // assignment
        .mockResolvedValueOnce(null); // global admin

      await expect(
        service.getStats(1, { projectId: 'uuid-123' })
      ).rejects.toThrow();
    });

    it('should allow access for global admin', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ id: 42 });
      mockUserAssignmentRepo.findOne
        .mockResolvedValueOnce(null) // no direct assignment
        .mockResolvedValueOnce({ userId: 1 }); // global admin

      const corrQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
        where: jest.fn().mockReturnThis(),
      });
      mockCorrespondenceRepo.createQueryBuilder.mockReturnValue(corrQb);

      const wfQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      });
      mockWorkflowInstanceRepo.createQueryBuilder.mockReturnValue(wfQb);

      mockDataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getStats(1, { projectId: 'uuid-123' });
      expect(result.totalDocuments).toBe(1);
    });

    it('should handle empty count results gracefully', async () => {
      const corrQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
      });
      mockCorrespondenceRepo.createQueryBuilder.mockReturnValue(corrQb);

      const wfQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
      });
      mockWorkflowInstanceRepo.createQueryBuilder.mockReturnValue(wfQb);

      mockDataSource.query
        .mockResolvedValueOnce([]) // empty rfa
        .mockResolvedValueOnce([{ count: null }]) // null circulations
        .mockResolvedValueOnce([{ count: '' }]); // empty approved

      const result = await service.getStats(1, {});
      expect(result.totalRfas).toBe(0);
      expect(result.totalCirculations).toBe(0);
      expect(result.approved).toBe(0);
    });
  });

  describe('getActivity', () => {
    it('should return activity items without projectId', async () => {
      const mockLogs = [
        {
          auditId: '1',
          action: 'CREATE',
          entityType: 'Correspondence',
          entityId: 'uuid-1',
          detailsJson: { foo: 'bar' },
          createdAt: new Date(),
          user: { username: 'testuser', firstName: 'Test', lastName: 'User' },
        },
      ];
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue(mockLogs),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getActivity(1, { limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('CREATE');
      expect(result[0].user?.username).toBe('testuser');
    });

    it('should return activity items with projectId', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ id: 42 });
      mockUserAssignmentRepo.findOne
        .mockResolvedValueOnce({ userId: 1, projectId: 42 })
        .mockResolvedValueOnce(null);

      const mockLogs: unknown[] = [];
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue(mockLogs),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getActivity(1, { projectId: 'uuid-123' });

      expect(result).toEqual([]);
    });

    it('should handle activity with no user', async () => {
      const mockLogs = [
        {
          auditId: '2',
          action: 'DELETE',
          entityType: 'Project',
          entityId: 'uuid-2',
          detailsJson: undefined,
          createdAt: new Date(),
          user: undefined,
        },
      ];
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue(mockLogs),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getActivity(1, {});

      expect(result).toHaveLength(1);
      expect(result[0].user).toBeUndefined();
    });

    it('should use default limit when not provided', async () => {
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getActivity(1, {});

      expect(qb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getPending', () => {
    it('should return pending tasks without projectId', async () => {
      const mockTasks = [
        {
          instanceId: 'inst-1',
          workflowCode: 'WF-001',
          currentState: 'PENDING',
          entityType: 'rfa_revision',
          entityId: '123',
          documentNumber: 'RFA-001',
          subject: 'Test Subject',
          assignedAt: new Date(),
        },
      ];
      mockDataSource.query
        .mockResolvedValueOnce(mockTasks) // tasks query
        .mockResolvedValueOnce([{ total: '1' }]); // count query

      const result = await service.getPending(1, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should return pending tasks with projectId', async () => {
      mockProjectRepo.findOne.mockResolvedValue({ id: 42 });
      mockUserAssignmentRepo.findOne
        .mockResolvedValueOnce({ userId: 1, projectId: 42 })
        .mockResolvedValueOnce(null);

      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce([{ total: '0' }]); // count

      const result = await service.getPending(1, { projectId: 'uuid-123' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should handle empty count result', async () => {
      mockDataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getPending(1, {});

      expect(result.meta.total).toBe(0);
    });

    it('should use default page and limit', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '5' }]);

      const result = await service.getPending(1, {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(5);
    });
  });
});
