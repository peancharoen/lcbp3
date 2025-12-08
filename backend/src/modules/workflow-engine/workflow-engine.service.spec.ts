import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
} from './entities/workflow-instance.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import { WorkflowDslService } from './workflow-dsl.service';
import { WorkflowEventService } from './workflow-event.service';
import { NotFoundException } from '@nestjs/common';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let defRepo: Repository<WorkflowDefinition>;
  let instanceRepo: Repository<WorkflowInstance>;
  let dslService: WorkflowDslService;
  let eventService: WorkflowEventService;

  // Mock Objects
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockDslService = {
    compile: jest.fn(),
    evaluate: jest.fn(),
  };

  const mockEventService = {
    dispatchEvents: jest.fn(),
  };

  const mockCompiledWorkflow = {
    initialState: 'START',
    states: {
      START: { transitions: { SUBMIT: 'PENDING' } },
      PENDING: { transitions: { APPROVE: 'APPROVED', REJECT: 'REJECTED' } },
      APPROVED: { terminal: true },
      REJECTED: { terminal: true },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        {
          provide: getRepositoryToken(WorkflowDefinition),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkflowInstance),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkflowHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: WorkflowDslService, useValue: mockDslService },
        { provide: WorkflowEventService, useValue: mockEventService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    defRepo = module.get(getRepositoryToken(WorkflowDefinition));
    instanceRepo = module.get(getRepositoryToken(WorkflowInstance));
    dslService = module.get(WorkflowDslService);
    eventService = module.get(WorkflowEventService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDefinition', () => {
    it('should create a new definition version', async () => {
      const dto = {
        workflow_code: 'WF01',
        dsl: {},
      } as CreateWorkflowDefinitionDto;
      mockDslService.compile.mockReturnValue(mockCompiledWorkflow);
      (defRepo.findOne as jest.Mock).mockResolvedValue({ version: 1 });
      (defRepo.create as jest.Mock).mockReturnValue({ version: 2 });
      (defRepo.save as jest.Mock).mockResolvedValue({
        version: 2,
        workflow_code: 'WF01',
      });

      const result = await service.createDefinition(dto);

      expect(dslService.compile).toHaveBeenCalledWith(dto.dsl);
      expect(defRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2 })
      );
      expect(result).toEqual(expect.objectContaining({ version: 2 }));
    });
  });

  describe('createInstance', () => {
    it('should create a new instance with initial state', async () => {
      const mockDef = {
        id: 'def-1',
        compiled: mockCompiledWorkflow,
      };

      (defRepo.findOne as jest.Mock).mockResolvedValue(mockDef);
      (instanceRepo.create as jest.Mock).mockReturnValue({
        id: 'inst-1',
        currentState: 'START',
      });
      (instanceRepo.save as jest.Mock).mockResolvedValue({ id: 'inst-1' });

      const result = await service.createInstance('WF01', 'DOC', '101');

      expect(instanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentState: 'START',
          entityId: '101',
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if definition not found', async () => {
      (defRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createInstance('WF01', 'DOC', '101')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processTransition', () => {
    it('should process transition successfully and commit transaction', async () => {
      const instanceId = 'inst-1';
      const mockInstance = {
        id: instanceId,
        currentState: 'PENDING',
        status: WorkflowStatus.ACTIVE,
        definition: { compiled: mockCompiledWorkflow },
        context: { some: 'data' },
      };

      // Mock Pessimistic Lock Find
      mockQueryRunner.manager.findOne.mockResolvedValue(mockInstance);

      // Mock DSL Evaluation
      mockDslService.evaluate.mockReturnValue({
        nextState: 'APPROVED',
        events: [{ type: 'NOTIFY' }],
      });

      const result = await service.processTransition(instanceId, 'APPROVE', 1);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockDslService.evaluate).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2); // Instance + History
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(eventService.dispatchEvents).toHaveBeenCalled(); // Should dispatch events
      expect(result.nextState).toBe('APPROVED');
      expect(result.isCompleted).toBe(true);
    });

    it('should rollback transaction on error', async () => {
      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.processTransition('inst-1', 'APPROVE', 1)
      ).rejects.toThrow('DB Error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
