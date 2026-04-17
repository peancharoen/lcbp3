import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransmittalService } from './transmittal.service';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import {
  ValidationException,
  NotFoundException,
} from '../../common/exceptions';
import { User } from '../user/entities/user.entity';

describe('TransmittalService', () => {
  let service: TransmittalService;
  let transmittalRepo: { findOne: jest.Mock };
  let revisionRepo: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let statusRepo: { findOne: jest.Mock };
  let dataSource: {
    manager: { findOne: jest.Mock };
    createQueryRunner: jest.Mock;
  };
  let workflowEngine: {
    getInstanceByEntity: jest.Mock;
    createInstance: jest.Mock;
    processTransition: jest.Mock;
  };

  const mockUser: Partial<User> = {
    user_id: 1,
    username: 'testuser',
    primaryOrganizationId: 10,
  };

  const mockTransmittal = {
    correspondenceId: 99,
    items: [{ itemCorrespondenceId: 201 }, { itemCorrespondenceId: 202 }],
  };

  const mockQB = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: { save: jest.fn() },
  };

  beforeEach(async () => {
    transmittalRepo = { findOne: jest.fn() };
    revisionRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQB),
      save: jest.fn(),
    };
    statusRepo = { findOne: jest.fn() };
    dataSource = {
      manager: { findOne: jest.fn() },
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };
    workflowEngine = {
      getInstanceByEntity: jest.fn(),
      createInstance: jest.fn(),
      processTransition: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransmittalService,
        { provide: getRepositoryToken(Transmittal), useValue: transmittalRepo },
        {
          provide: getRepositoryToken(TransmittalItem),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: statusRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useValue: revisionRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: DocumentNumberingService, useValue: {} },
        { provide: UuidResolverService, useValue: {} },
        {
          provide: UserService,
          useValue: { getUserPermissions: jest.fn().mockResolvedValue([]) },
        },
        { provide: WorkflowEngineService, useValue: workflowEngine },
      ],
    }).compile();

    service = module.get<TransmittalService>(TransmittalService);
  });

  describe('submit() - EC-RFA-004', () => {
    const uuid = '019abc01-0000-7000-8000-000000000001';

    beforeEach(() => {
      dataSource.manager.findOne.mockResolvedValue({
        id: 99,
        correspondenceNumber: 'TRN-2026-001',
      });
      transmittalRepo.findOne.mockResolvedValue(mockTransmittal);
    });

    it('throws ValidationException when an item correspondence is in DRAFT state (EC-RFA-004)', async () => {
      mockQB.getMany.mockResolvedValue([
        { correspondence: { correspondenceNumber: 'RFA-2026-001' } },
      ]);

      await expect(service.submit(uuid, mockUser as User)).rejects.toThrow(
        ValidationException
      );
    });

    it('includes the draft document number in the error response', async () => {
      mockQB.getMany.mockResolvedValue([
        { correspondence: { correspondenceNumber: 'RFA-2026-001' } },
      ]);

      let thrownError: unknown;
      try {
        await service.submit(uuid, mockUser as User);
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(ValidationException);
      const res = (thrownError as ValidationException).getResponse();
      const resStr = typeof res === 'string' ? res : JSON.stringify(res);
      expect(resStr).toContain('RFA-2026-001');
    });

    it('creates a workflow instance when no items are in DRAFT state', async () => {
      mockQB.getMany.mockResolvedValue([]);
      workflowEngine.createInstance.mockResolvedValue({
        id: 'wf-instance-uuid-001',
      });
      workflowEngine.processTransition.mockResolvedValue({
        nextState: 'IN_REVIEW',
      });
      revisionRepo.findOne.mockResolvedValue({
        id: 55,
        correspondenceId: 99,
        isCurrent: true,
        statusId: 1,
      });
      statusRepo.findOne
        .mockResolvedValueOnce({ id: 1, statusCode: 'DRAFT' })
        .mockResolvedValueOnce({ id: 2, statusCode: 'SUBMITTED' });

      const result = await service.submit(uuid, mockUser as User);

      expect(workflowEngine.createInstance).toHaveBeenCalledWith(
        'TRANSMITTAL_FLOW_V1',
        'transmittal',
        '99',
        expect.objectContaining({ ownerId: 1 })
      );
      expect(result).toEqual({
        instanceId: 'wf-instance-uuid-001',
        currentState: 'IN_REVIEW',
      });
    });

    it('throws NotFoundException when correspondence publicId is not found', async () => {
      dataSource.manager.findOne.mockResolvedValue(null);

      await expect(service.submit(uuid, mockUser as User)).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws NotFoundException when transmittal record is not found', async () => {
      transmittalRepo.findOne.mockResolvedValue(null);

      await expect(service.submit(uuid, mockUser as User)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findOneByUuid() - workflowInstanceId exposure (ADR-021)', () => {
    const uuid = '019abc02-0000-7000-8000-000000000002';

    it('returns workflowInstanceId and workflowState when a workflow instance exists', async () => {
      dataSource.manager.findOne.mockResolvedValue({ id: 99 });
      transmittalRepo.findOne.mockResolvedValue({
        correspondenceId: 99,
        transmittalNo: 'TRN-001',
        subject: 'Test',
        correspondence: {
          id: 99,
          publicId: uuid,
          correspondenceNumber: 'TRN-001',
        },
        items: [],
      });
      workflowEngine.getInstanceByEntity.mockResolvedValue({
        id: 'wf-uuid-123',
        currentState: 'IN_REVIEW',
        availableActions: ['APPROVE', 'REJECT'],
      });

      const result = await service.findOneByUuid(uuid);

      expect(workflowEngine.getInstanceByEntity).toHaveBeenCalledWith(
        'transmittal',
        '99'
      );
      expect(result.workflowInstanceId).toBe('wf-uuid-123');
      expect(result.workflowState).toBe('IN_REVIEW');
      expect(result.availableActions).toEqual(['APPROVE', 'REJECT']);
    });

    it('returns undefined workflowInstanceId when no workflow instance exists (Draft state)', async () => {
      dataSource.manager.findOne.mockResolvedValue({ id: 99 });
      transmittalRepo.findOne.mockResolvedValue({
        correspondenceId: 99,
        transmittalNo: 'TRN-001',
        items: [],
        correspondence: {
          id: 99,
          publicId: uuid,
          correspondenceNumber: 'TRN-001',
        },
      });
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      const result = await service.findOneByUuid(uuid);

      expect(result.workflowInstanceId).toBeUndefined();
      expect(result.workflowState).toBeUndefined();
      expect(result.availableActions).toEqual([]);
    });
  });
});
