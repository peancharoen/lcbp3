import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CirculationService } from './circulation.service';
import { Circulation } from './entities/circulation.entity';
import { CirculationRouting } from './entities/circulation-routing.entity';
import { CirculationStatusCode } from './entities/circulation-status-code.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import {
  ValidationException,
  NotFoundException,
} from '../../common/exceptions';
import { User } from '../user/entities/user.entity';

describe('CirculationService', () => {
  let service: CirculationService;
  let circulationRepo: { findOne: jest.Mock; save: jest.Mock };
  let routingRepo: { findOne: jest.Mock; save: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };
  let uuidResolver: { resolveUserId: jest.Mock };
  let workflowEngine: { getInstanceByEntity: jest.Mock };

  const mockUser: Partial<User> = { user_id: 1, username: 'admin' };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: { save: jest.fn() },
  };

  beforeEach(async () => {
    circulationRepo = { findOne: jest.fn(), save: jest.fn() };
    routingRepo = { findOne: jest.fn(), save: jest.fn() };
    uuidResolver = { resolveUserId: jest.fn() };
    workflowEngine = { getInstanceByEntity: jest.fn() };
    dataSource = { createQueryRunner: jest.fn(() => mockQueryRunner) };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CirculationService,
        { provide: getRepositoryToken(Circulation), useValue: circulationRepo },
        {
          provide: getRepositoryToken(CirculationRouting),
          useValue: routingRepo,
        },
        {
          provide: getRepositoryToken(CirculationStatusCode),
          useValue: { findOne: jest.fn() },
        },
        { provide: DataSource, useValue: dataSource },
        { provide: DocumentNumberingService, useValue: {} },
        { provide: UuidResolverService, useValue: uuidResolver },
        {
          provide: UserService,
          useValue: { getUserPermissions: jest.fn().mockResolvedValue([]) },
        },
        { provide: WorkflowEngineService, useValue: workflowEngine },
      ],
    }).compile();

    service = module.get<CirculationService>(CirculationService);
  });

  describe('reassignRouting() - EC-CIRC-001', () => {
    it('reassigns a PENDING routing to a new user by UUID', async () => {
      const mockRouting = {
        id: 5,
        status: 'PENDING',
        assignedTo: 10,
        circulation: {},
      };
      routingRepo.findOne.mockResolvedValue(mockRouting);
      uuidResolver.resolveUserId.mockResolvedValue(99);
      routingRepo.save.mockResolvedValue({ ...mockRouting, assignedTo: 99 });

      const result = await service.reassignRouting(
        5,
        'new-user-uuid',
        mockUser as User
      );

      expect(uuidResolver.resolveUserId).toHaveBeenCalledWith('new-user-uuid');
      expect(routingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 99 })
      );
      expect(result.assignedTo).toBe(99);
    });

    it('throws ValidationException when routing is not in PENDING status', async () => {
      routingRepo.findOne.mockResolvedValue({
        id: 5,
        status: 'COMPLETED',
        circulation: {},
      });

      await expect(
        service.reassignRouting(5, 'new-user-uuid', mockUser as User)
      ).rejects.toThrow(ValidationException);
    });

    it('throws NotFoundException when routing does not exist', async () => {
      routingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reassignRouting(999, 'new-user-uuid', mockUser as User)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('forceClose() - EC-CIRC-002', () => {
    const uuid = '019circ-0000-7000-8000-000000000001';

    const buildMockCirculation = () => ({
      id: 100,
      publicId: uuid,
      circulationNo: 'CIRC-2026-001',
      statusCode: 'OPEN',
      routings: [
        { id: 1, status: 'PENDING', comments: null, completedAt: null },
        {
          id: 2,
          status: 'COMPLETED',
          comments: 'done',
          completedAt: new Date(),
        },
        { id: 3, status: 'IN_PROGRESS', comments: null, completedAt: null },
      ],
    });

    beforeEach(() => {
      circulationRepo.findOne.mockResolvedValue(buildMockCirculation());
    });

    it('saves rejected routings and commits the transaction', async () => {
      await service.forceClose(uuid, 'Budget cut', mockUser as User);

      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('returns success=true and affectedRoutings count of 2', async () => {
      const result = await service.forceClose(
        uuid,
        'Cost savings',
        mockUser as User
      );

      expect(result.success).toBe(true);
      expect(result.affectedRoutings).toBe(2);
    });

    it('throws ValidationException when reason is an empty string', async () => {
      await expect(
        service.forceClose(uuid, '', mockUser as User)
      ).rejects.toThrow(ValidationException);
    });

    it('throws ValidationException when reason is only whitespace', async () => {
      await expect(
        service.forceClose(uuid, '   ', mockUser as User)
      ).rejects.toThrow(ValidationException);
    });

    it('throws ValidationException when circulation is already COMPLETED', async () => {
      circulationRepo.findOne.mockResolvedValue({
        ...buildMockCirculation(),
        statusCode: 'COMPLETED',
      });

      await expect(
        service.forceClose(uuid, 'Trying to close completed', mockUser as User)
      ).rejects.toThrow(ValidationException);
    });

    it('throws ValidationException when circulation is already CANCELLED', async () => {
      circulationRepo.findOne.mockResolvedValue({
        ...buildMockCirculation(),
        statusCode: 'CANCELLED',
      });

      await expect(
        service.forceClose(uuid, 'Already cancelled', mockUser as User)
      ).rejects.toThrow(ValidationException);
    });

    it('throws NotFoundException when circulation is not found', async () => {
      circulationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forceClose(uuid, 'Not found', mockUser as User)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne() - basic lookup', () => {
    it('should return circulation when found', async () => {
      const mockCirculation = {
        id: 1,
        publicId: 'circ-uuid-1',
        routings: [],
        correspondence: {},
        creator: {},
      };
      circulationRepo.findOne.mockResolvedValue(mockCirculation);

      const result = await service.findOne(1);

      expect(circulationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: [
          'routings',
          'routings.assignee',
          'correspondence',
          'creator',
        ],
        order: { routings: { stepNumber: 'ASC' } },
      });
      expect(result).toEqual(mockCirculation);
    });

    it('should throw NotFoundException when circulation not found', async () => {
      circulationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('close() - FR-C09', () => {
    const uuid = '019circ-close-0000-7000-8000-000000000001';

    it('should close circulation when all routings are completed', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'OPEN',
        routings: [
          { id: 1, status: 'COMPLETED' },
          { id: 2, status: 'COMPLETED' },
        ],
      });
      circulationRepo.save.mockResolvedValue(undefined);

      const result = await service.close(uuid, mockUser as User);

      expect(result).toEqual({ success: true });
      expect(circulationRepo.save).toHaveBeenCalled();
    });

    it('should throw ValidationException when circulation is already COMPLETED', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'COMPLETED',
        routings: [],
      });

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException when circulation is already CANCELLED', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'CANCELLED',
        routings: [],
      });

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException when circulation is already CLOSED', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'CLOSED',
        routings: [],
      });

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException when pending routings exist', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'OPEN',
        routings: [
          { id: 1, status: 'COMPLETED' },
          { id: 2, status: 'PENDING' },
        ],
      });

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException when in-progress routings exist', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: uuid,
        circulationNo: 'CIRC-2026-005',
        statusCode: 'OPEN',
        routings: [{ id: 1, status: 'IN_PROGRESS' }],
      });

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw NotFoundException when circulation not found', async () => {
      circulationRepo.findOne.mockResolvedValue(null);

      await expect(service.close(uuid, mockUser as User)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findAll() - search with pagination', () => {
    it('should return empty result when user has no org and no correspondencePublicId', async () => {
      const userWithoutOrg = { user_id: 1, username: 'noorg' } as User;

      const result = await service.findAll({}, userWithoutOrg);

      expect(result).toEqual({
        data: [],
        meta: { total: 0, page: 1, limit: 20 },
      });
    });

    it('should query by organization when user has org', async () => {
      const userWithOrg = {
        user_id: 1,
        username: 'admin',
        primaryOrganizationId: 10,
      } as User;

      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      };
      circulationRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);

      const result = await service.findAll({}, userWithOrg);

      expect(mockQB.where).toHaveBeenCalledWith('c.organizationId = :orgId', {
        orgId: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should query by correspondencePublicId when provided', async () => {
      const userWithOrg = {
        user_id: 1,
        username: 'admin',
        primaryOrganizationId: 10,
      } as User;

      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      circulationRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);

      await service.findAll(
        { correspondencePublicId: 'corr-uuid-1' },
        userWithOrg
      );

      expect(mockQB.where).toHaveBeenCalledWith(
        'correspondence.publicId = :corrPublicId',
        {
          corrPublicId: 'corr-uuid-1',
        }
      );
    });

    it('should apply status filter when provided', async () => {
      const userWithOrg = {
        user_id: 1,
        username: 'admin',
        primaryOrganizationId: 10,
      } as User;

      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      circulationRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);

      await service.findAll({ status: 'OPEN' }, userWithOrg);

      expect(mockQB.andWhere).toHaveBeenCalledWith('c.statusCode = :status', {
        status: 'OPEN',
      });
    });
  });

  describe('updateRoutingStatus()', () => {
    it('should update routing and complete circulation when all done', async () => {
      const mockRouting = {
        id: 5,
        assignedTo: 1,
        circulationId: 10,
        circulation: { id: 10 },
      };
      routingRepo.findOne.mockResolvedValue(mockRouting);
      routingRepo.save.mockResolvedValue(mockRouting);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      routingRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);
      circulationRepo.update = jest.fn().mockResolvedValue(undefined);

      const result = await service.updateRoutingStatus(
        5,
        { status: 'COMPLETED', comments: 'Done' },
        mockUser as User
      );

      expect(routingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED', comments: 'Done' })
      );
      expect(circulationRepo.update).toHaveBeenCalledWith(10, {
        statusCode: 'COMPLETED',
        closedAt: expect.any(Date),
      });
      expect(result).toEqual(mockRouting);
    });

    it('should not complete circulation when pending routings remain', async () => {
      const mockRouting = {
        id: 5,
        assignedTo: 1,
        circulationId: 10,
        circulation: { id: 10 },
      };
      routingRepo.findOne.mockResolvedValue(mockRouting);
      routingRepo.save.mockResolvedValue(mockRouting);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
      };
      routingRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);
      circulationRepo.update = jest.fn();

      await service.updateRoutingStatus(
        5,
        { status: 'COMPLETED', comments: 'Done' },
        mockUser as User
      );

      expect(circulationRepo.update).not.toHaveBeenCalled();
    });

    it('should throw PermissionException when user is not the assignee', async () => {
      const mockRouting = {
        id: 5,
        assignedTo: 99,
        circulationId: 10,
        circulation: { id: 10 },
      };
      routingRepo.findOne.mockResolvedValue(mockRouting);

      await expect(
        service.updateRoutingStatus(
          5,
          { status: 'COMPLETED' },
          mockUser as User
        )
      ).rejects.toThrow();
    });

    it('should throw NotFoundException when routing not found', async () => {
      routingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRoutingStatus(
          999,
          { status: 'COMPLETED' },
          mockUser as User
        )
      ).rejects.toThrow(NotFoundException);
    });
  });
});
