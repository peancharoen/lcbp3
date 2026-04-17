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

  describe('findOneByUuid() - EC-CIRC-003 workflowInstanceId + deadlineDate', () => {
    it('exposes workflowInstanceId and deadlineDate when a workflow instance exists', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 100,
        publicId: '019circ-test-uuid',
        circulationNo: 'CIRC-001',
        subject: 'Test',
        statusCode: 'OPEN',
        routings: [],
        deadlineDate: '2026-04-20',
      });
      workflowEngine.getInstanceByEntity.mockResolvedValue({
        id: 'wf-circ-uuid-001',
        currentState: 'OPEN',
        availableActions: [],
      });

      const result = await service.findOneByUuid('019circ-test-uuid');

      expect(workflowEngine.getInstanceByEntity).toHaveBeenCalledWith(
        'circulation',
        '100'
      );
      expect(result.workflowInstanceId).toBe('wf-circ-uuid-001');
      expect(result.workflowState).toBe('OPEN');
      expect((result as { deadlineDate?: string }).deadlineDate).toBe(
        '2026-04-20'
      );
    });

    it('returns empty availableActions and undefined workflowInstanceId in draft state', async () => {
      circulationRepo.findOne.mockResolvedValue({
        id: 101,
        publicId: '019circ-draft-uuid',
        circulationNo: 'CIRC-002',
        statusCode: 'DRAFT',
        routings: [],
      });
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      const result = await service.findOneByUuid('019circ-draft-uuid');

      expect(result.workflowInstanceId).toBeUndefined();
      expect(result.availableActions).toEqual([]);
    });
  });
});
