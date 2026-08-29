// ADR-021 Clarify Q2 (C1): Mock Redlock ก่อน import service
// ใช้ module-level mock เพื่อบังคับให้ constructor `new Redlock(...)` ในการสร้าง service
const mockRedlockAcquire = jest.fn();
const mockRedlockRelease = jest.fn().mockResolvedValue(undefined);
jest.mock('redlock', () =>
  jest.fn().mockImplementation(() => ({
    acquire: mockRedlockAcquire,
  }))
);

import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
} from './entities/workflow-instance.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { WorkflowDslService } from './workflow-dsl.service';
import { UserService } from '../user/user.service';
import { WorkflowEventService } from './workflow-event.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
// ADR-007: \u0e43\u0e0a\u0e49 custom exceptions \u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e08\u0e32\u0e01 common/exceptions (\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e49 @nestjs/common built-in)
import {
  NotFoundException,
  WorkflowException,
  ConflictException,
  ServiceUnavailableException,
} from '../../common/exceptions';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';

// Token ของ @nestjs-modules/ioredis — default Redis connection
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('WorkflowEngineService', () => {
  let compiledModule: TestingModule;
  let service: WorkflowEngineService;
  let defRepo: Repository<WorkflowDefinition>;
  let instanceRepo: Repository<WorkflowInstance>;
  let attachmentRepo: { find: jest.Mock; update: jest.Mock };
  let dslService: WorkflowDslService;
  let eventService: WorkflowEventService;

  // Mock Objects
  const mockCasQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      // ADR-001 v1.1 FR-002: CAS version increment mock
      createQueryBuilder: jest.fn().mockReturnValue(mockCasQueryBuilder),
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
    // ADR-021 C1: default Redlock behavior = acquire สำเร็จ
    mockRedlockAcquire.mockReset().mockResolvedValue({
      release: mockRedlockRelease,
    });
    mockRedlockRelease.mockClear();

    compiledModule = await Test.createTestingModule({
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
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(WorkflowHistory),
          useValue: {
            create: jest.fn((dto: unknown) => dto), // คืน args ที่ส่งไป เพื่อให้ manager.save ได้ history object
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: {
            find: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 0 }),
          },
        },
        { provide: WorkflowDslService, useValue: mockDslService },
        { provide: WorkflowEventService, useValue: mockEventService },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        // ADR-021 C1: Redis mock สำหรับ @InjectRedis()
        {
          provide: DEFAULT_REDIS_TOKEN,
          useValue: {
            // ไม่จำเป็นต้องมี method จริง เพราะ Redlock ถูก mock แล้ว
          },
        },
        // ADR-021 S1: Prometheus metrics mocks
        {
          provide: 'PROM_METRIC_WORKFLOW_REDLOCK_ACQUIRE_DURATION_MS',
          useValue: {
            labels: jest.fn().mockReturnThis(),
            observe: jest.fn(),
          },
        },
        {
          provide: 'PROM_METRIC_WORKFLOW_REDLOCK_ACQUIRE_FAILURES_TOTAL',
          useValue: {
            inc: jest.fn(),
          },
        },
        // FR-023: Per-transition metrics mocks
        {
          provide: 'PROM_METRIC_WORKFLOW_TRANSITIONS_TOTAL',
          useValue: {
            labels: jest.fn().mockReturnThis(),
            inc: jest.fn(),
          },
        },
        {
          provide: 'PROM_METRIC_WORKFLOW_TRANSITION_DURATION_MS',
          useValue: {
            labels: jest.fn().mockReturnThis(),
            observe: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserPermissions: jest.fn().mockResolvedValue([]),
            findOne: jest
              .fn()
              .mockRejectedValue(new NotFoundException('User', '1')),
          },
        },
      ],
    }).compile();

    service = compiledModule.get<WorkflowEngineService>(WorkflowEngineService);
    defRepo = compiledModule.get(getRepositoryToken(WorkflowDefinition));
    instanceRepo = compiledModule.get(getRepositoryToken(WorkflowInstance));
    attachmentRepo = compiledModule.get(getRepositoryToken(Attachment));
    dslService = compiledModule.get(WorkflowDslService);
    eventService = compiledModule.get(WorkflowEventService);
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

    // ADR-021 T031: Tests for step-specific attachments
    describe('ADR-021 Step-specific Attachments', () => {
      it('should link attachments to workflow history record', async () => {
        const instanceId = 'inst-1';
        const attachmentPublicIds = ['att-123', 'att-456'];
        const mockInstance = {
          id: instanceId,
          currentState: 'PENDING_REVIEW', // ADR-021 C3: allowed upload state
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: { some: 'data' },
        };

        // C3 pre-check ดึง instance จาก instanceRepo.findOne (ไม่ใช่ queryRunner)
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: instanceId,
          currentState: 'PENDING_REVIEW',
        });

        // Mock the history object with an ID
        const mockHistory = { id: 'history-123' };
        mockQueryRunner.manager.findOne.mockResolvedValue(mockInstance);
        mockQueryRunner.manager.save.mockResolvedValue(mockHistory);
        // C2: update ต้องรายงาน affected = attachmentPublicIds.length
        mockQueryRunner.manager.update.mockResolvedValue({
          affected: attachmentPublicIds.length,
        });

        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });

        await service.processTransition(
          instanceId,
          'APPROVE',
          1,
          'Test comment',
          {},
          attachmentPublicIds
        );

        // C2: where clause ต้องมี guards ครบ 3 ชั้น
        expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
          Attachment,
          {
            publicId: In(attachmentPublicIds),
            isTemporary: false,
            uploadedByUserId: 1,
            workflowHistoryId: null,
          },
          { workflowHistoryId: 'history-123' }
        );
      });

      it('should skip attachment linking when no attachmentPublicIds provided', async () => {
        const instanceId = 'inst-1';
        const mockInstance = {
          id: instanceId,
          currentState: 'PENDING',
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: { some: 'data' },
        };

        mockQueryRunner.manager.findOne.mockResolvedValue(mockInstance);
        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });

        await service.processTransition(instanceId, 'APPROVE', 1);

        expect(mockQueryRunner.manager.update).not.toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({ workflowHistoryId: expect.any(String) })
        );
      });

      it('should handle empty attachmentPublicIds array', async () => {
        const instanceId = 'inst-1';
        const mockInstance = {
          id: instanceId,
          currentState: 'PENDING',
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: { some: 'data' },
        };

        mockQueryRunner.manager.findOne.mockResolvedValue(mockInstance);
        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });

        await service.processTransition(
          instanceId,
          'APPROVE',
          1,
          'Test comment',
          {},
          [] // Empty array
        );

        expect(mockQueryRunner.manager.update).not.toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({ workflowHistoryId: expect.any(String) })
        );
      });
    });

    // ============================================================
    // ADR-021 T031a: Clarify Session 2026-04-19 Amendments
    // ============================================================
    describe('ADR-021 Clarify Q1+Q2 (T031a) — state check, Redlock, guards', () => {
      const attachmentPublicIds = ['att-1'];

      it('C3: should throw ConflictException (409) when uploading in APPROVED state', async () => {
        // Arrange: currentState = APPROVED (terminal, ไม่อยู่ใน UPLOAD_ALLOWED_STATES)
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'APPROVED',
        });

        // Act + Assert
        await expect(
          service.processTransition(
            'inst-1',
            'APPROVE',
            1,
            undefined,
            {},
            attachmentPublicIds
          )
        ).rejects.toThrow(ConflictException);

        // Redlock ต้องไม่ถูกเรียก (pre-check บล็อกก่อน)
        expect(mockRedlockAcquire).not.toHaveBeenCalled();
      });

      it('C3: should throw ConflictException (409) when uploading in REJECTED state', async () => {
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'REJECTED',
        });

        await expect(
          service.processTransition(
            'inst-1',
            'APPROVE',
            1,
            undefined,
            {},
            attachmentPublicIds
          )
        ).rejects.toThrow(ConflictException);
      });

      it('C3: should skip state check when attachmentPublicIds is empty', async () => {
        // ถ้าไม่มี attachment ไม่ต้องตรวจ state — transition ในสถานะไหนก็ได้
        const mockInstance = {
          id: 'inst-1',
          currentState: 'DRAFT',
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: {},
        };
        mockQueryRunner.manager.findOne.mockResolvedValue(mockInstance);
        mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-1' });
        mockDslService.evaluate.mockReturnValue({
          nextState: 'PENDING',
          events: [],
        });

        await expect(
          service.processTransition('inst-1', 'SUBMIT', 1)
        ).resolves.toBeDefined();

        // pre-check ต้องไม่ถูกเรียก (ไม่มี attachments)
        expect(instanceRepo.findOne).not.toHaveBeenCalled();
      });

      it('C1: should throw ServiceUnavailableException (503) when Redlock acquire fails', async () => {
        // Arrange: state check ผ่าน
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_REVIEW',
        });
        // Redlock ล้มเหลว — Redis ล่ม / ไม่สามารถ acquire หลัง retry 3 ครั้ง
        mockRedlockAcquire.mockRejectedValue(
          new Error('ExecutionError: unable to achieve quorum')
        );

        // Act + Assert
        await expect(
          service.processTransition(
            'inst-1',
            'APPROVE',
            1,
            undefined,
            {},
            attachmentPublicIds
          )
        ).rejects.toThrow(ServiceUnavailableException);

        // DB transaction ต้องไม่เคยเริ่ม (fail-closed before DB work)
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
      });

      it('C2: should rollback and throw when update.affected < expected (temp/foreign attachment)', async () => {
        // Arrange: state ผ่าน, Redlock ผ่าน, DB transaction เดินไปถึง update
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_APPROVAL',
        });
        mockQueryRunner.manager.findOne.mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_APPROVAL',
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: {},
        });
        mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-999' });
        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });
        // affected < expected — แปลว่ามีไฟล์บางไฟล์ temp / ของคนอื่น / ผูกไปแล้ว
        mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

        await expect(
          service.processTransition(
            'inst-1',
            'APPROVE',
            1,
            undefined,
            {},
            ['att-1', 'att-2', 'att-3'] // ขอ 3 ไฟล์ แต่ affected = 1
          )
        ).rejects.toThrow(WorkflowException);

        // ต้อง rollback
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        // ต้องไม่ commit
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        // ต้อง release Redlock
        expect(mockRedlockRelease).toHaveBeenCalled();
      });

      it('H1: should throw ConflictException when state changes between pre-check and pessimistic lock (TOCTOU)', async () => {
        // Arrange: pre-check พบ PENDING_REVIEW (stale read)
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_REVIEW',
        });
        // แต่ภายใน transaction (pessimistic lock) state เปลี่ยนเป็น APPROVED แล้ว
        // (simulate: another request transition ไปก่อนที่ Redlock จะ release)
        mockQueryRunner.manager.findOne.mockResolvedValue({
          id: 'inst-1',
          currentState: 'APPROVED', // ← เปลี่ยนไปแล้ว
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow },
          context: {},
        });
        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });

        await expect(
          service.processTransition(
            'inst-1',
            'APPROVE',
            1,
            undefined,
            {},
            attachmentPublicIds
          )
        ).rejects.toThrow(ConflictException);

        // ต้อง rollback transaction + release Redlock
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(mockRedlockRelease).toHaveBeenCalled();
        // attachment update ต้องไม่ถูกเรียก
        expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      });

      it('C1: should release Redlock even when transition succeeds', async () => {
        (instanceRepo.findOne as jest.Mock).mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_REVIEW',
        });
        mockQueryRunner.manager.findOne.mockResolvedValue({
          id: 'inst-1',
          currentState: 'PENDING_REVIEW',
          status: WorkflowStatus.ACTIVE,
          definition: { compiled: mockCompiledWorkflow, workflow_code: 'WF01' },
          context: {},
          versionNo: 1,
        });
        mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-1' });
        mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
        mockCasQueryBuilder.execute.mockResolvedValue({ affected: 1 });
        mockDslService.evaluate.mockReturnValue({
          nextState: 'APPROVED',
          events: [],
        });

        await service.processTransition('inst-1', 'APPROVE', 1, undefined, {}, [
          'att-1',
        ]);

        expect(mockRedlockAcquire).toHaveBeenCalledWith(
          ['lock:wf:transition:inst-1'],
          10000
        );
        expect(mockRedlockRelease).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // T024: ADR-001 v1.1 FR-002 — Optimistic Lock Tests
  // ============================================================
  describe('Optimistic Lock (FR-002)', () => {
    const baseInstance = {
      id: 'inst-opt-1',
      currentState: 'PENDING_REVIEW',
      status: WorkflowStatus.ACTIVE,
      definition: { compiled: mockCompiledWorkflow, workflow_code: 'WF01' },
      context: {},
      versionNo: 5,
    };

    it('T024a: should throw ConflictException (409) when clientVersionNo does not match current versionNo (fast-fail)', async () => {
      // Arrange: DB มี version_no=5, client ส่ง version_no=3 (ล้าสมัย)
      (instanceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'inst-opt-1',
        versionNo: 5,
      });

      // Act + Assert
      await expect(
        service.processTransition(
          'inst-opt-1',
          'APPROVE',
          1,
          undefined,
          {},
          undefined,
          'user-uuid-123',
          3 // clientVersionNo ล้าสมัย
        )
      ).rejects.toThrow(ConflictException);

      // Fast-fail: Redlock ต้องไม่ถูกเรียก (ผ่าน check ก่อน acquire)
      expect(mockRedlockAcquire).not.toHaveBeenCalled();
    });

    it('T024b: should pass fast-fail and proceed when clientVersionNo matches current versionNo', async () => {
      // Arrange: clientVersionNo ตรงกับ DB
      (instanceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'inst-opt-1',
        currentState: 'PENDING_REVIEW',
        versionNo: 5,
      });
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...baseInstance,
        versionNo: 5,
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-1' });
      mockCasQueryBuilder.execute.mockResolvedValue({ affected: 1 });
      mockDslService.evaluate.mockReturnValue({
        nextState: 'APPROVED',
        events: [],
      });

      // Act
      const result = await service.processTransition(
        'inst-opt-1',
        'APPROVE',
        1,
        undefined,
        {},
        undefined,
        'user-uuid-123',
        5 // clientVersionNo ตรง
      );

      // Assert: สำเร็จ + คืน versionNo ใหม่
      expect(result.success).toBe(true);
      expect(result.versionNo).toBe(6); // 5 + 1
      expect(mockRedlockAcquire).toHaveBeenCalled();
    });

    it('T024c: should throw ConflictException when CAS update returns affected=0 (TOCTOU edge case)', async () => {
      // Arrange: fast-fail ผ่าน (ไม่ส่ง clientVersionNo), แต่ CAS ล้มเหลว
      (instanceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'inst-opt-1',
        currentState: 'PENDING_REVIEW',
        versionNo: 5,
      });
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...baseInstance,
        versionNo: 5,
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-1' });
      // CAS: เกิด TOCTOU — version_no ถูกเปลี่ยนระหว่าง Redlock acquire กับ CAS update
      mockCasQueryBuilder.execute.mockResolvedValue({ affected: 0 });
      mockDslService.evaluate.mockReturnValue({
        nextState: 'APPROVED',
        events: [],
      });

      // Act + Assert
      await expect(
        service.processTransition(
          'inst-opt-1',
          'APPROVE',
          1,
          undefined,
          {},
          undefined
          // ไม่ส่ง clientVersionNo — TOCTOU ถูกตรวจโดย CAS layer
        )
      ).rejects.toThrow(ConflictException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('T024d: should rollback attachments to temp when DB transaction fails (FR-019)', async () => {
      // Arrange: commit ล้มเหลว — คาดว่า attachments จะถูก revert กลับเป็น temp
      (instanceRepo.findOne as jest.Mock).mockResolvedValue({
        currentState: 'PENDING_REVIEW',
      }); // ผ่าน pre-check, transaction จะ fail ที่ commit
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...baseInstance,
        versionNo: 5,
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-1' });
      // CAS สำเร็จ
      mockCasQueryBuilder.execute.mockResolvedValue({ affected: 1 });
      // commitTransaction ล้มเหลว
      mockQueryRunner.commitTransaction.mockRejectedValueOnce(
        new Error('DB connection lost')
      );
      mockDslService.evaluate.mockReturnValue({
        nextState: 'APPROVED',
        events: [],
      });

      // Act + Assert
      await expect(
        service.processTransition(
          'inst-opt-1',
          'APPROVE',
          1,
          undefined,
          {},
          ['att-rollback-1', 'att-rollback-2'] // แนบไฟล์ 2 ไฟล์
        )
      ).rejects.toThrow(Error);

      // FR-019: attachmentRepo.update ต้องถูกเรียกเพื่อ revert ไฟล์กลับเป็น temp
      expect(attachmentRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          publicId: In(['att-rollback-1', 'att-rollback-2']),
        }),
        expect.objectContaining({ isTemporary: true })
      );
    });
  });

  // ============================================================
  // T048: ADR-001 FR-007 — DSL Redis Cache Invalidation Tests
  // ============================================================
  describe('DSL Redis Cache Invalidation (FR-007, SC-005)', () => {
    it('T048a: update() should invalidate cache when DSL changes', async () => {
      // Arrange
      const mockDef = {
        id: 'def-cache-1',
        workflow_code: 'RFA_V1',
        version: 2,
        is_active: false,
        dsl: {},
        compiled: {},
      };
      (defRepo.findOne as jest.Mock).mockResolvedValue(mockDef);
      (defRepo.save as jest.Mock).mockResolvedValue({ ...mockDef, version: 2 });
      mockDslService.compile.mockReturnValue(mockCompiledWorkflow);

      const cacheManager = compiledModule.get<{
        del: jest.Mock;
        set: jest.Mock;
        get: jest.Mock;
      }>(CACHE_MANAGER);

      // Act
      await service.update('def-cache-1', {
        dsl: {
          workflow: 'RFA_V1',
          states: [],
        } as unknown as import('./dto/create-workflow-definition.dto').CreateWorkflowDefinitionDto['dsl'],
      });

      // Assert: cache del เรียกด้วย version key
      expect(cacheManager.del).toHaveBeenCalledWith('wf:def:RFA_V1:2');
      // Assert: re-cache เรียกหลัง del
      expect(cacheManager.set).toHaveBeenCalledWith(
        'wf:def:RFA_V1:2',
        expect.any(Object),
        3_600_000
      );
    });

    it('T048b: update() should invalidate active pointer when is_active toggles to true', async () => {
      // Arrange: definition เดิม is_active = false
      const mockDef = {
        id: 'def-cache-2',
        workflow_code: 'TRANSMITTAL_V1',
        version: 1,
        is_active: false,
        dsl: {},
        compiled: {},
      };
      (defRepo.findOne as jest.Mock).mockResolvedValue(mockDef);
      (defRepo.save as jest.Mock).mockResolvedValue({
        ...mockDef,
        is_active: true,
      });

      const cacheManager = compiledModule.get<{
        del: jest.Mock;
        set: jest.Mock;
        get: jest.Mock;
      }>(CACHE_MANAGER);

      // Act: activate definition
      await service.update('def-cache-2', { is_active: true });

      // Assert: active pointer ถูกลบออกจาก cache
      expect(cacheManager.del).toHaveBeenCalledWith(
        'wf:def:TRANSMITTAL_V1:active'
      );
    });

    it('T048c: createDefinition() should set cache with version key after save', async () => {
      // Arrange
      (defRepo.findOne as jest.Mock).mockResolvedValue({ version: 3 });
      (defRepo.create as jest.Mock).mockReturnValue({
        workflow_code: 'WF_CACHE',
        version: 4,
      });
      (defRepo.save as jest.Mock).mockResolvedValue({
        workflow_code: 'WF_CACHE',
        version: 4,
      });
      mockDslService.compile.mockReturnValue(mockCompiledWorkflow);
      const cacheManager = compiledModule.get<{
        del: jest.Mock;
        set: jest.Mock;
        get: jest.Mock;
      }>(CACHE_MANAGER);

      // Act
      await service.createDefinition({
        workflow_code: 'WF_CACHE',
        dsl: {},
      } as import('./dto/create-workflow-definition.dto').CreateWorkflowDefinitionDto);

      // Assert: cache set ด้วย version key
      expect(cacheManager.set).toHaveBeenCalledWith(
        'wf:def:WF_CACHE:4',
        expect.objectContaining({ workflow_code: 'WF_CACHE', version: 4 }),
        3_600_000
      );
    });

    it('T048d: getDefinitionById() should return from cache on cache hit', async () => {
      // Arrange: cache มีข้อมูลอยู่แล้ว
      const cachedDef = {
        id: 'def-hit-1',
        workflow_code: 'CACHED_WF',
        version: 1,
      };
      const cacheManager = compiledModule.get<{
        del: jest.Mock;
        set: jest.Mock;
        get: jest.Mock;
      }>(CACHE_MANAGER);
      cacheManager.get.mockResolvedValueOnce(cachedDef);

      // Act
      const result = await service.getDefinitionById('def-hit-1');

      // Assert: ไม่ต้องออก DB
      expect(result).toEqual(cachedDef);
      expect(defRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ====================================================================
  // ADR-049: T008-T010 — statusProjection + impersonation + approveCode
  // TDD RED phase — tests จะ fail ก่อน implement T008-T010
  // ====================================================================
  describe('ADR-049: statusProjection + impersonation + approveCode', () => {
    const mockAdr049Workflow = {
      initialState: 'DRAFT',
      states: {
        DRAFT: {
          transitions: { SUBMIT: { to: 'CONSULTANT_REVIEW' } },
          terminal: false,
          statusProjection: { rfa: 'DFT' },
        },
        CONSULTANT_REVIEW: {
          transitions: { CONSENT_FOR_APPROVE: { to: 'OWNER_APPROVAL' } },
          terminal: false,
          statusProjection: { rfa: 'FRE' },
        },
        OWNER_APPROVAL: {
          transitions: { APPROVE: { to: 'APPROVED', approveCode: '1' } },
          terminal: false,
          statusProjection: { rfa: 'FAP' },
        },
        APPROVED: {
          transitions: {},
          terminal: true,
          statusProjection: { rfa: 'FCO' },
        },
      },
    };

    const setupSuccessfulTransition = (currentState: string) => {
      mockQueryRunner.manager.findOne.mockReset();
      mockQueryRunner.manager.save.mockReset();
      mockQueryRunner.commitTransaction.mockReset();
      mockQueryRunner.rollbackTransaction.mockReset();
      mockDslService.evaluate.mockReset();
      mockCasQueryBuilder.execute
        .mockReset()
        .mockResolvedValue({ affected: 1 });
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 'inst-1',
        currentState,
        status: WorkflowStatus.ACTIVE,
        versionNo: 1,
        definition: { compiled: mockAdr049Workflow },
        context: {},
      });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'history-123' });
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      mockDslService.evaluate.mockReturnValue({
        nextState: 'APPROVED',
        events: [],
        approveCode: '1',
      });
    };

    it('T008: should write statusProjection to history metadata on transition', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      await service.processTransition('inst-1', 'APPROVE', 1);
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toState: 'APPROVED',
          metadata: expect.objectContaining({
            statusProjection: { rfa: 'FCO' },
          }),
        })
      );
    });

    it('T009: should write impersonation fields to history when impersonated', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      const userService = compiledModule.get(UserService);
      userService.getUserPermissions = jest
        .fn()
        .mockResolvedValue(['system.manage_all']);
      userService.findOne = jest.fn().mockResolvedValue({
        user_id: 100,
        publicId: '019505a1-7c3e-7000-8000-owner001',
        isActive: true,
      });
      await service.processTransition(
        'inst-1',
        'APPROVE',
        999,
        'Admin on behalf',
        {},
        undefined,
        '019505a1-7c3e-7000-8000-admin001',
        undefined,
        true,
        100,
        '019505a1-7c3e-7000-8000-owner001'
      );
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          impersonated: true,
          onBehalfOfUserId: 100,
          onBehalfOfUserUuid: '019505a1-7c3e-7000-8000-owner001',
        })
      );
    });

    it('T010: should write approveCode to history metadata when DSL transition has approveCode', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      await service.processTransition('inst-1', 'APPROVE', 1);
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          metadata: expect.objectContaining({ approveCode: '1' }),
        })
      );
    });

    it('T024: should return statusProjection per module type from DSL state', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      const result = await service.processTransition('inst-1', 'APPROVE', 1);
      expect(result.statusProjection).toEqual({ rfa: 'FCO' });
    });

    it('T028: should reject approveCode that does not match DSL transition', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      // DSL says approveCode = '1', client sends '2'
      await expect(
        service.processTransition('inst-1', 'APPROVE', 1, 'wrong code', {
          approveCode: '2',
        })
      ).rejects.toBeInstanceOf(Error);
    });
    it('T033a: should reject impersonation if actor lacks admin permission', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      const userService = compiledModule.get(UserService);
      userService.getUserPermissions = jest
        .fn()
        .mockResolvedValue(['correspondence.view']);
      userService.findOne = jest.fn().mockResolvedValue({
        user_id: 100,
        publicId: '019505a1-7c3e-7000-8000-owner001',
        isActive: true,
      });
      await expect(
        service.processTransition(
          'inst-1',
          'APPROVE',
          999,
          'Admin on behalf',
          {},
          undefined,
          '019505a1-7c3e-7000-8000-admin001',
          undefined,
          true,
          100,
          '019505a1-7c3e-7000-8000-owner001'
        )
      ).rejects.toBeInstanceOf(WorkflowException);
    });

    it('T033b: should include onBehalfOfUserActive=false when original handler is deactivated', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      const userService = compiledModule.get(UserService);
      userService.getUserPermissions = jest
        .fn()
        .mockResolvedValue(['system.manage_all']);
      userService.findOne = jest.fn().mockResolvedValue({
        user_id: 100,
        publicId: '019505a1-7c3e-7000-8000-owner001',
        isActive: false,
      });
      const result = await service.processTransition(
        'inst-1',
        'APPROVE',
        999,
        'Admin on behalf',
        {},
        undefined,
        '019505a1-7c3e-7000-8000-admin001',
        undefined,
        true,
        100,
        '019505a1-7c3e-7000-8000-owner001'
      );
      expect(result.onBehalfOfUserActive).toBe(false);
      expect(result.onBehalfOfUserPublicId).toBe(
        '019505a1-7c3e-7000-8000-owner001'
      );
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          metadata: expect.objectContaining({ onBehalfOfUserActive: false }),
        })
      );
    });

    it('T009: should default impersonated=false when no impersonation params', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      await service.processTransition('inst-1', 'APPROVE', 1);
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          impersonated: false,
        })
      );
    });

    it('EC1: OWNER RESUBMIT should transition to CONSULTANT_REVIEW (non-terminal) with approveCode 3', async () => {
      setupSuccessfulTransition('OWNER_APPROVAL');
      mockDslService.evaluate.mockReturnValue({
        nextState: 'CONSULTANT_REVIEW',
        events: [],
        approveCode: '3',
      });

      await service.processTransition('inst-1', 'RESUBMIT', 1);

      // Verify instance was saved with non-terminal state (first save = instance)
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          currentState: 'CONSULTANT_REVIEW',
          status: WorkflowStatus.ACTIVE,
        })
      );
      // Verify history saved with approveCode 3 (second save = history)
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toState: 'CONSULTANT_REVIEW',
          metadata: expect.objectContaining({
            approveCode: '3',
          }),
        })
      );
    });

    it('EC2: DESIGNER OBJECTED should transition to CONSULTANT_REVIEW with comment preserved', async () => {
      setupSuccessfulTransition('DESIGNER_REVIEW');
      mockDslService.evaluate.mockReturnValue({
        nextState: 'CONSULTANT_REVIEW',
        events: [],
      });

      await service.processTransition('inst-1', 'OBJECTED', 1, undefined, {
        comment: 'Design needs revision on structural load',
      });

      // Verify instance stays ACTIVE (non-terminal)
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          currentState: 'CONSULTANT_REVIEW',
          status: WorkflowStatus.ACTIVE,
        })
      );
      // Verify history saved with OBJECTED action
      expect(mockQueryRunner.manager.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toState: 'CONSULTANT_REVIEW',
          action: 'OBJECTED',
        })
      );
    });
  });

  describe('validateDsl', () => {
    it('should return valid=true when DSL compiles successfully', () => {
      mockDslService.compile.mockReturnValue(mockCompiledWorkflow);
      const result = service.validateDsl({ workflow: 'TEST', states: [] });
      expect(result.valid).toBe(true);
    });

    it('should return valid=false with errors when DSL compilation fails', () => {
      mockDslService.compile.mockImplementation(() => {
        throw new Error('Invalid DSL: missing states');
      });
      const result = service.validateDsl({ workflow: 'BAD' });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      if (!result.valid) {
        expect(result.errors[0].message).toContain('Invalid DSL');
      }
    });
  });

  describe('getAvailableActions', () => {
    it('should return action keys from compiled DSL state', async () => {
      const compiled = {
        states: {
          PENDING: { transitions: { APPROVE: {}, REJECT: {}, COMMENT: {} } },
        },
      };
      jest.spyOn(defRepo, 'findOne').mockResolvedValue({
        compiled: compiled as unknown as Record<string, unknown>,
      } as WorkflowDefinition);

      const actions = await service.getAvailableActions('TEST_FLOW', 'PENDING');
      expect(actions).toEqual(['APPROVE', 'REJECT', 'COMMENT']);
    });

    it('should return empty array when definition not found', async () => {
      jest.spyOn(defRepo, 'findOne').mockResolvedValue(null);
      const actions = await service.getAvailableActions('UNKNOWN', 'START');
      expect(actions).toEqual([]);
    });

    it('should return empty array when state not found in compiled DSL', async () => {
      jest.spyOn(defRepo, 'findOne').mockResolvedValue({
        compiled: { states: { OTHER_STATE: { transitions: {} } } },
      } as WorkflowDefinition);
      const actions = await service.getAvailableActions(
        'TEST_FLOW',
        'UNKNOWN_STATE'
      );
      expect(actions).toEqual([]);
    });
  });

  describe('getLatestInstanceByEntity', () => {
    it('should return latest instance ordered by createdAt DESC', async () => {
      const mockInstance = { id: 'inst-1', currentState: 'PENDING' };
      jest
        .spyOn(instanceRepo, 'findOne')
        .mockResolvedValue(mockInstance as WorkflowInstance);
      const result = await service.getLatestInstanceByEntity('RFA', '123');
      expect(result).toEqual(mockInstance);
      expect(instanceRepo.findOne).toHaveBeenCalledWith({
        where: { entityType: 'RFA', entityId: '123' },
        order: { createdAt: 'DESC' },
        relations: ['definition'],
      });
    });

    it('should return null when no instance found', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue(null);
      const result = await service.getLatestInstanceByEntity('RFA', '999');
      expect(result).toBeNull();
    });
  });

  describe('getInstanceById', () => {
    it('should return instance when found', async () => {
      const mockInstance = { id: 'inst-1', currentState: 'DRAFT' };
      jest
        .spyOn(instanceRepo, 'findOne')
        .mockResolvedValue(mockInstance as WorkflowInstance);
      const result = await service.getInstanceById('inst-1');
      expect(result).toEqual(mockInstance);
    });

    it('should throw NotFoundException when instance not found', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue(null);
      await expect(service.getInstanceById('missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getInstanceByEntity', () => {
    it('should return null when no active instance found', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue(null);
      const result = await service.getInstanceByEntity('RFA', '123');
      expect(result).toBeNull();
    });

    it('should return instance with availableActions from compiled DSL', async () => {
      const compiled = {
        states: {
          PENDING: { transitions: { APPROVE: {}, REJECT: {} } },
        },
      };
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue({
        id: 'inst-1',
        currentState: 'PENDING',
        status: WorkflowStatus.ACTIVE,
        definition: { compiled },
      } as unknown as WorkflowInstance);

      const result = await service.getInstanceByEntity('RFA', '123');
      expect(result).toEqual({
        id: 'inst-1',
        currentState: 'PENDING',
        availableActions: ['APPROVE', 'REJECT'],
      });
    });

    it('should return empty availableActions when compiled DSL has no transitions', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue({
        id: 'inst-1',
        currentState: 'DRAFT',
        status: WorkflowStatus.ACTIVE,
        definition: { compiled: { states: { DRAFT: {} } } },
      } as unknown as WorkflowInstance);

      const result = await service.getInstanceByEntity('RFA', '123');
      expect(result?.availableActions).toEqual([]);
    });
  });

  describe('terminateInstance', () => {
    it('should set status=CANCELLED and currentState=CANCELLED', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue({
        id: 'inst-1',
        versionNo: 1,
      } as WorkflowInstance);
      const updateSpy = instanceRepo.update as jest.Mock;
      updateSpy.mockClear();

      await service.terminateInstance('inst-1', 'Document cancelled');
      expect(updateSpy).toHaveBeenCalledWith('inst-1', {
        status: WorkflowStatus.CANCELLED,
        currentState: 'CANCELLED',
      });
    });

    it('should throw NotFoundException when instance not found', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.terminateInstance('missing', 'test')
      ).rejects.toThrow(NotFoundException);
    });

    it('should work without reason parameter', async () => {
      jest.spyOn(instanceRepo, 'findOne').mockResolvedValue({
        id: 'inst-1',
        versionNo: 1,
      } as WorkflowInstance);
      const updateSpy = instanceRepo.update as jest.Mock;
      updateSpy.mockClear();

      await service.terminateInstance('inst-1');
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('getDefinitions', () => {
    it('should return latest version of each workflow definition', async () => {
      const mockDefs = [
        { workflow_code: 'RFA_APPROVAL', version: 2 },
        { workflow_code: 'CIRCULATION', version: 2 },
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockDefs),
      };
      (
        defRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder = jest.fn().mockReturnValue(qb);
      const result = await service.getDefinitions();
      expect(result).toEqual(mockDefs);
      expect(qb.where).toHaveBeenCalled();
    });
  });

  describe('update — DSL validation', () => {
    it('should throw WorkflowException when DSL is invalid', async () => {
      jest.spyOn(defRepo, 'findOne').mockResolvedValue({
        id: 'def-1',
        dsl: {},
        compiled: {},
      } as WorkflowDefinition);
      mockDslService.compile.mockImplementation(() => {
        throw new Error('DSL syntax error');
      });

      await expect(
        service.update('def-1', { dsl: { bad: true } } as never)
      ).rejects.toThrow();
    });

    it('should update DSL and compiled when valid', async () => {
      const def = { id: 'def-1', dsl: {}, compiled: {} };
      jest
        .spyOn(defRepo, 'findOne')
        .mockResolvedValue(def as WorkflowDefinition);
      mockDslService.compile.mockReturnValue(mockCompiledWorkflow);
      const saveSpy = jest
        .spyOn(defRepo, 'save')
        .mockResolvedValue(def as WorkflowDefinition);

      await service.update('def-1', { dsl: { workflow: 'NEW' } } as never);
      expect(saveSpy).toHaveBeenCalled();
      expect(def.dsl).toEqual({ workflow: 'NEW' });
    });
  });
});
