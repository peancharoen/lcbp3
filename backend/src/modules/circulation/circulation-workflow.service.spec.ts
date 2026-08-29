// File: src/modules/circulation/circulation-workflow.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ CirculationWorkflowService (ADR-049 T021)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CirculationWorkflowService } from './circulation-workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { Circulation } from './entities/circulation.entity';
import { CirculationStatusCode } from './entities/circulation-status-code.entity';
import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';

describe('CirculationWorkflowService', () => {
  let service: CirculationWorkflowService;

  const mockCirculationRepo = {
    findOne: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };
  const mockStatusRepo = {};
  const mockWorkflowEngine = {
    createInstance: jest.fn(),
    processTransition: jest.fn(),
    getInstanceById: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CirculationWorkflowService,
        {
          provide: WorkflowEngineService,
          useValue: mockWorkflowEngine,
        },
        {
          provide: getRepositoryToken(Circulation),
          useValue: mockCirculationRepo,
        },
        {
          provide: getRepositoryToken(CirculationStatusCode),
          useValue: mockStatusRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CirculationWorkflowService>(
      CirculationWorkflowService
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startCirculation', () => {
    it('ควรสร้าง workflow instance และ sync status ได้', async () => {
      const circulation: Partial<Circulation> = {
        id: 1,
        organizationId: 10,
        statusCode: 'OPEN',
      };
      mockCirculationRepo.findOne.mockResolvedValue(circulation);
      mockWorkflowEngine.createInstance.mockResolvedValue({ id: 'inst-1' });
      mockWorkflowEngine.processTransition.mockResolvedValue({
        nextState: 'IN_REVIEW',
        statusProjection: { circulation: 'IN_REVIEW' },
      });

      const result = await service.startCirculation(1, 99);

      expect(mockWorkflowEngine.createInstance).toHaveBeenCalledWith(
        'CIRCULATION_FLOW_V1',
        'circulation',
        '1',
        { organizationId: 10, creatorId: 99 }
      );
      expect(mockWorkflowEngine.processTransition).toHaveBeenCalledWith(
        'inst-1',
        'START',
        99,
        'Start Circulation Process',
        {}
      );
      expect(result).toEqual({
        instanceId: 'inst-1',
        currentState: 'IN_REVIEW',
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('ควร throw NotFoundException เมื่อไม่พบ circulation', async () => {
      mockCirculationRepo.findOne.mockResolvedValue(null);

      await expect(service.startCirculation(999, 99)).rejects.toThrow(
        NotFoundException
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อ workflowEngine  throw error', async () => {
      mockCirculationRepo.findOne.mockResolvedValue({
        id: 1,
        organizationId: 10,
      });
      mockWorkflowEngine.createInstance.mockRejectedValue(
        new Error('Engine error')
      );

      await expect(service.startCirculation(1, 99)).rejects.toThrow(
        'Engine error'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('ควร sync status เป็น COMPLETED และตั้ง closedAt', async () => {
      const circulation: Partial<Circulation> = {
        id: 2,
        organizationId: 10,
        statusCode: 'IN_REVIEW',
      };
      mockCirculationRepo.findOne.mockResolvedValue(circulation);
      mockWorkflowEngine.createInstance.mockResolvedValue({ id: 'inst-2' });
      mockWorkflowEngine.processTransition.mockResolvedValue({
        nextState: 'COMPLETED',
        statusProjection: { circulation: 'COMPLETED' },
      });

      await service.startCirculation(2, 99);

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 'COMPLETED',
          closedAt: expect.any(Date),
        })
      );
    });
  });

  describe('processAction', () => {
    const dto: WorkflowTransitionDto = {
      action: 'APPROVE',
      comment: 'OK',
      payload: { note: 'approved' },
    };

    it('ควรส่ง action ไปยัง engine และ sync status', async () => {
      const transitionResult = {
        nextState: 'COMPLETED',
        statusProjection: { circulation: 'COMPLETED' },
      };
      mockWorkflowEngine.processTransition.mockResolvedValue(transitionResult);
      mockWorkflowEngine.getInstanceById.mockResolvedValue({
        entityType: 'circulation',
        entityId: '5',
      });
      const circulation: Partial<Circulation> = {
        id: 5,
        statusCode: 'IN_REVIEW',
      };
      mockCirculationRepo.findOne.mockResolvedValue(circulation);
      mockCirculationRepo.manager.save.mockResolvedValue(circulation);

      const result = await service.processAction('inst-1', 99, dto);

      expect(mockWorkflowEngine.processTransition).toHaveBeenCalledWith(
        'inst-1',
        'APPROVE',
        99,
        'OK',
        { note: 'approved' }
      );
      expect(result).toEqual(transitionResult);
      expect(mockCirculationRepo.manager.save).toHaveBeenCalled();
    });

    it('ควรไม่ sync status เมื่อ instance ไม่ใช่ circulation', async () => {
      mockWorkflowEngine.processTransition.mockResolvedValue({
        nextState: 'DONE',
        statusProjection: {},
      });
      mockWorkflowEngine.getInstanceById.mockResolvedValue({
        entityType: 'rfa',
        entityId: '5',
      });

      await service.processAction('inst-1', 99, dto);

      expect(mockCirculationRepo.findOne).not.toHaveBeenCalled();
    });

    it('ควรไม่ sync status เมื่อไม่พบ circulation', async () => {
      mockWorkflowEngine.processTransition.mockResolvedValue({
        nextState: 'DONE',
        statusProjection: {},
      });
      mockWorkflowEngine.getInstanceById.mockResolvedValue({
        entityType: 'circulation',
        entityId: '999',
      });
      mockCirculationRepo.findOne.mockResolvedValue(null);

      await service.processAction('inst-1', 99, dto);

      expect(mockCirculationRepo.manager.save).not.toHaveBeenCalled();
    });

    it('ควรไม่ throw เมื่อ getInstanceById คืน null', async () => {
      mockWorkflowEngine.processTransition.mockResolvedValue({
        nextState: 'DONE',
        statusProjection: {},
      });
      mockWorkflowEngine.getInstanceById.mockResolvedValue(null);

      const result = await service.processAction('inst-1', 99, dto);

      expect(result.nextState).toBe('DONE');
    });
  });
});
