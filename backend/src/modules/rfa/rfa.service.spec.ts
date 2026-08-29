// File: backend/src/modules/rfa/rfa.service.spec.ts
// Change Log:
// - 2026-08-26: ADR-049 T019: RfaService MVP unit tests — statusProjection + approveCode sync
// - 2026-08-28: เพิ่ม tests สำหรับ findAll, findOne, findOneByUuid, findOneByUuidRaw, submit, update, cancel

import { RfaService } from './rfa.service';
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface';
import { WorkflowException } from '../../common/exceptions';
import { NotFoundException } from '../../common/exceptions';
import { User } from '../user/entities/user.entity';
import type { Rfa } from './entities/rfa.entity';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { WorkflowActionDto } from '../correspondence/dto/workflow-action.dto';
import { UpdateRfaDto } from './dto/update-rfa.dto';
import { SearchRfaDto } from './dto/search-rfa.dto';

type CreateRevisionArgs = Parameters<RfaService['createRevision']>;

describe('RfaService ADR-049 statusProjection + consent reason', () => {
  let service: RfaService;
  const workflowEngine: {
    processTransition: jest.Mock;
    getInstanceByEntity: jest.Mock;
    getLatestInstanceByEntity: jest.Mock;
    createInstance: jest.Mock;
  } = {
    processTransition: jest.fn(),
    getInstanceByEntity: jest.fn(),
    getLatestInstanceByEntity: jest.fn(),
    createInstance: jest.fn(),
  };
  const rfaRevisionRepo = { save: jest.fn() };
  const rfaStatusRepo = { findOne: jest.fn() };
  const rfaApproveRepo = { findOne: jest.fn() };
  const rfaConsentReasonRepo = { findOne: jest.fn() };
  const baseRfa = {
    id: 1,
    correspondence: {
      publicId: 'rfa-uuid-1',
      revisions: [
        {
          isCurrent: true,
          rfaRevision: { id: 100, rfaStatusCodeId: 1, details: {} },
        },
      ],
    },
  } as unknown as Rfa;
  const baseUser = { user_id: 1, publicId: 'user-uuid' } as unknown as User;

  beforeEach(() => {
    jest.resetAllMocks();
    service = Object.create(RfaService.prototype) as RfaService;
    Object.assign(service as unknown as Record<string, unknown>, {
      workflowEngine: workflowEngine as unknown as WorkflowEngineService,
      rfaRevisionRepo,
      rfaStatusRepo,
      rfaApproveRepo,
      rfaConsentReasonRepo,
      logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    });
  });

  const setupPassingTransition = (approveCode: string = '1') => {
    jest.spyOn(service, 'findOne').mockResolvedValue(baseRfa as unknown as Rfa);
    workflowEngine.getInstanceByEntity.mockResolvedValue({
      id: 'wf-instance-1',
      currentState: 'OWNER_APPROVAL',
    });
    workflowEngine.processTransition.mockResolvedValue({
      nextState: 'APPROVED',
      previousState: 'OWNER_APPROVAL',
      isCompleted: true,
      statusProjection: { rfa: 'FCO' },
      approveCode,
      impersonated: false,
      onBehalfOfUserPublicId: undefined,
    });
    rfaStatusRepo.findOne.mockResolvedValue({ id: 2, statusCode: 'FCO' });
    rfaApproveRepo.findOne.mockResolvedValue({ id: 10, approveCode });
  };

  it('T019: should sync RFA revision status from DSL statusProjection and approve code', async () => {
    setupPassingTransition('1');
    const dto = {
      action: WorkflowAction.APPROVE,
      approveCode: '1',
    } as unknown as WorkflowActionDto;
    await service.processAction(1, dto, baseUser);

    expect(rfaStatusRepo.findOne).toHaveBeenCalledWith({
      where: { statusCode: 'FCO' },
    });
    expect(rfaApproveRepo.findOne).toHaveBeenCalledWith({
      where: { approveCode: '1', isActive: true },
    });
    expect(rfaRevisionRepo.save).toHaveBeenCalled();
  });

  it('T034: should process RESUBMIT to terminal REVISE_REQUIRED with approveCode 3', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(baseRfa as unknown as Rfa);
    workflowEngine.getInstanceByEntity.mockResolvedValue({
      id: 'wf-instance-1',
      currentState: 'CONSULTANT_REVIEW',
    });
    workflowEngine.processTransition.mockResolvedValue({
      nextState: 'REVISE_REQUIRED',
      previousState: 'CONSULTANT_REVIEW',
      isCompleted: true,
      statusProjection: { rfa: 'DFT' },
      approveCode: '3',
      impersonated: false,
      onBehalfOfUserPublicId: undefined,
    });
    rfaStatusRepo.findOne.mockResolvedValue({ id: 1, statusCode: 'DFT' });
    rfaApproveRepo.findOne.mockResolvedValue({ id: 11, approveCode: '3' });

    const dto = {
      action: WorkflowAction.RESUBMIT,
    } as unknown as WorkflowActionDto;
    const result = await service.processAction(1, dto, baseUser);

    expect(workflowEngine.processTransition).toHaveBeenCalledWith(
      'wf-instance-1',
      WorkflowAction.RESUBMIT,
      1,
      undefined,
      { approveCode: undefined, consentReasonCode: undefined, roles: [] },
      undefined,
      'user-uuid',
      undefined,
      false,
      undefined,
      undefined
    );
    expect(rfaApproveRepo.findOne).toHaveBeenCalledWith({
      where: { approveCode: '3', isActive: true },
    });
    // review-fix: processAction คืน contract shape ไม่ใช่ { message, result }
    expect(result.currentState).toBe('REVISE_REQUIRED');
  });

  it('review-fix: should process AGREED_WITH_COMMENTS from DESIGNER_REVIEW back to CONSULTANT_REVIEW', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(baseRfa as unknown as Rfa);
    workflowEngine.getInstanceByEntity.mockResolvedValue({
      id: 'wf-instance-1',
      currentState: 'DESIGNER_REVIEW',
    });
    workflowEngine.processTransition.mockResolvedValue({
      nextState: 'CONSULTANT_REVIEW',
      previousState: 'DESIGNER_REVIEW',
      isCompleted: false,
      statusProjection: { rfa: 'FRE' },
      approveCode: undefined,
      impersonated: false,
      onBehalfOfUserPublicId: undefined,
    });
    rfaStatusRepo.findOne.mockResolvedValue({ id: 2, statusCode: 'FRE' });

    const dto = {
      action: WorkflowAction.AGREED_WITH_COMMENTS,
    } as unknown as WorkflowActionDto;
    const result = await service.processAction(1, dto, baseUser);

    expect(workflowEngine.processTransition).toHaveBeenCalledWith(
      'wf-instance-1',
      WorkflowAction.AGREED_WITH_COMMENTS,
      1,
      undefined,
      expect.objectContaining({ roles: [] }),
      undefined,
      'user-uuid',
      undefined,
      false,
      undefined,
      undefined
    );
    expect(result.currentState).toBe('CONSULTANT_REVIEW');
    expect(result.rfaStatus).toBe('FRE');
  });

  it('review-fix: should persist approve code 4 for REJECT action (no special-casing)', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(baseRfa as unknown as Rfa);
    workflowEngine.getInstanceByEntity.mockResolvedValue({
      id: 'wf-instance-1',
      currentState: 'OWNER_APPROVAL',
    });
    workflowEngine.processTransition.mockResolvedValue({
      nextState: 'REJECTED',
      previousState: 'OWNER_APPROVAL',
      isCompleted: true,
      statusProjection: { rfa: 'CC' },
      approveCode: '4',
      impersonated: false,
      onBehalfOfUserPublicId: undefined,
    });
    rfaStatusRepo.findOne.mockResolvedValue({ id: 3, statusCode: 'CC' });
    rfaApproveRepo.findOne.mockResolvedValue({ id: 40, approveCode: '4' });

    const dto = {
      action: WorkflowAction.REJECT,
    } as unknown as WorkflowActionDto;
    await service.processAction(1, dto, baseUser);

    // ตรวจว่า approve code 4 ถูก persist (ไม่ถูก special-case ออก)
    expect(rfaApproveRepo.findOne).toHaveBeenCalledWith({
      where: { approveCode: '4', isActive: true },
    });
    expect(rfaRevisionRepo.save).toHaveBeenCalled();
  });

  it('T026/T029: should validate consent reason code against master data and persist to details', async () => {
    setupPassingTransition('1');
    rfaConsentReasonRepo.findOne.mockResolvedValue({
      id: 5,
      code: 'NO_OBJECTION',
      isActive: true,
    });

    const dto = {
      action: WorkflowAction.CONSENT_FOR_APPROVE,
      consentReasonCode: 'NO_OBJECTION',
    } as unknown as WorkflowActionDto;
    await service.processAction(1, dto, baseUser);

    expect(rfaConsentReasonRepo.findOne).toHaveBeenCalledWith({
      where: { code: 'NO_OBJECTION', isActive: true },
    });
    expect(rfaRevisionRepo.save).toHaveBeenCalled();
  });

  it('T035/T036: should create a new revision with a new workflow instance after terminal', async () => {
    const manager = {
      create: jest
        .fn()
        .mockImplementation(
          (_entity: unknown, data: Record<string, unknown>) => ({
            ...data,
            id: 201,
            publicId: 'rev-uuid-201',
          })
        ),
      save: jest.fn().mockImplementation((entity: unknown) => entity),
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    };

    Object.assign(service as unknown as Record<string, unknown>, {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      corrStatusRepo: {
        findOne: jest.fn().mockResolvedValue({ id: 1, statusCode: 'DRAFT' }),
      },
    });
    workflowEngine.getLatestInstanceByEntity.mockResolvedValue({
      id: 'wf-instance-old',
      status: 'COMPLETED',
    });
    workflowEngine.createInstance.mockResolvedValue({
      id: 'wf-instance-new',
    });
    rfaStatusRepo.findOne.mockResolvedValue({ id: 1, statusCode: 'DFT' });

    const terminalRfa = {
      id: 1,
      correspondence: {
        id: 1,
        correspondenceTypeId: 2,
        discipline: undefined,
        revisions: [
          {
            id: 100,
            isCurrent: true,
            rfaRevision: { id: 100, rfaStatusCodeId: 1 },
          },
        ],
      },
    } as unknown as Rfa;
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(terminalRfa as unknown as Rfa);

    const dto = {
      subject: 'Resubmitted RFA',
    } as unknown as CreateRevisionArgs[1];
    const result = await service.createRevision(1, dto, baseUser);

    expect(workflowEngine.getLatestInstanceByEntity).toHaveBeenCalledWith(
      'rfa',
      '1'
    );
    expect(workflowEngine.createInstance).toHaveBeenCalledWith(
      'RFA_APPROVAL',
      'rfa',
      '1',
      expect.objectContaining({ revisionId: expect.any(Number) })
    );
    expect(result.workflowInstancePublicId).toBe('wf-instance-new');
    expect(result.revisionPublicId).toBe('rev-uuid-201');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('T026/T029: should reject invalid consent reason code', async () => {
    setupPassingTransition('1');
    rfaConsentReasonRepo.findOne.mockResolvedValue(null);

    const dto = {
      action: WorkflowAction.CONSENT_FOR_APPROVE,
      consentReasonCode: 'INVALID_REASON',
    } as unknown as WorkflowActionDto;
    await expect(
      service.processAction(1, dto, baseUser)
    ).rejects.toBeInstanceOf(WorkflowException);
  });

  describe('findAll', () => {
    const createMockQb = (items: unknown[], total: number) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([items, total]),
    });

    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        rfaRepo: { createQueryBuilder: jest.fn() },
        userService: { getUserPermissions: jest.fn().mockResolvedValue([]) },
      });
    });

    it('should return paginated results with mapped items', async () => {
      const mockItems = [
        {
          id: 1,
          correspondence: {
            publicId: 'rfa-uuid-1',
            correspondenceNumber: 'RFA-001',
            revisions: [
              {
                id: 10,
                isCurrent: true,
                rfaRevision: { id: 100, statusCode: { statusCode: 'DFT' } },
              },
            ],
          },
        },
      ];
      (
        service as unknown as { rfaRepo: { createQueryBuilder: jest.Mock } }
      ).rfaRepo.createQueryBuilder.mockReturnValueOnce(
        createMockQb(mockItems, 1)
      );

      const result = await service.findAll({
        page: 1,
        limit: 20,
      } as SearchRfaDto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].publicId).toBe('rfa-uuid-1');
      expect(result.meta.total).toBe(1);
    });

    it('should use default pagination', async () => {
      (
        service as unknown as { rfaRepo: { createQueryBuilder: jest.Mock } }
      ).rfaRepo.createQueryBuilder.mockReturnValueOnce(createMockQb([], 0));

      const result = await service.findAll({} as SearchRfaDto);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter DFT documents for non-manage_all users with org', async () => {
      (
        service as unknown as { userService: { getUserPermissions: jest.Mock } }
      ).userService.getUserPermissions.mockResolvedValue(['rfa.view']);
      const qb = createMockQb([], 0);
      (
        service as unknown as { rfaRepo: { createQueryBuilder: jest.Mock } }
      ).rfaRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const userWithOrg = {
        user_id: 5,
        primaryOrganizationId: 10,
      } as unknown as User;
      await service.findAll(
        { page: 1, limit: 10 } as SearchRfaDto,
        userWithOrg
      );

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should filter DFT documents for non-manage_all users without org', async () => {
      (
        service as unknown as { userService: { getUserPermissions: jest.Mock } }
      ).userService.getUserPermissions.mockResolvedValue([]);
      const qb = createMockQb([], 0);
      (
        service as unknown as { rfaRepo: { createQueryBuilder: jest.Mock } }
      ).rfaRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const userNoOrg = {
        user_id: 5,
        primaryOrganizationId: null,
      } as unknown as User;
      await service.findAll({ page: 1, limit: 10 } as SearchRfaDto, userNoOrg);

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should show all DFT for system.manage_all users', async () => {
      (
        service as unknown as { userService: { getUserPermissions: jest.Mock } }
      ).userService.getUserPermissions.mockResolvedValue(['system.manage_all']);
      const qb = createMockQb([], 0);
      (
        service as unknown as { rfaRepo: { createQueryBuilder: jest.Mock } }
      ).rfaRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const adminUser = {
        user_id: 99,
        primaryOrganizationId: null,
      } as unknown as User;
      await service.findAll({ page: 1, limit: 10 } as SearchRfaDto, adminUser);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        rfaRepo: { findOne: jest.fn() },
      });
    });

    it('should return mapped RFA when found', async () => {
      const mockRfa = {
        id: 1,
        correspondence: {
          publicId: 'rfa-uuid-1',
          revisions: [
            {
              id: 10,
              isCurrent: true,
              rfaRevision: { id: 100, statusCode: { statusCode: 'DFT' } },
            },
          ],
        },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);

      const result = await service.findOne(1);

      expect(result).toEqual(
        expect.objectContaining({ id: 1, publicId: 'rfa-uuid-1' })
      );
    });

    it('should return raw RFA when rawEntities=true', async () => {
      const mockRfa = { id: 1, correspondence: { publicId: 'rfa-uuid-1' } };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);

      const result = await service.findOne(1, true);

      expect(result).toEqual(mockRfa);
    });

    it('should throw NotFoundException when not found', async () => {
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        correspondenceRepo: { findOne: jest.fn() },
        rfaRepo: { findOne: jest.fn() },
      });
    });

    it('should resolve UUID and return mapped RFA with workflow info', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      const mockRfa = {
        id: 5,
        correspondence: {
          publicId: 'rfa-uuid-1',
          revisions: [
            {
              id: 10,
              isCurrent: true,
              rfaRevision: { id: 100, statusCode: { statusCode: 'DFT' } },
            },
          ],
        },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);
      workflowEngine.getInstanceByEntity.mockResolvedValue({
        id: 'wf-1',
        currentState: 'DRAFT',
        availableActions: ['SUBMIT'],
      });

      const result = await service.findOneByUuid('rfa-uuid-1');

      expect(result.workflowInstanceId).toBe('wf-1');
      expect(result.workflowState).toBe('DRAFT');
      expect(result.availableActions).toEqual(['SUBMIT']);
    });

    it('should throw NotFoundException when correspondence not found', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('rfa-uuid-999')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle null workflow instance', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue({
        id: 5,
        correspondence: {
          publicId: 'rfa-uuid-1',
          revisions: [
            {
              id: 10,
              isCurrent: true,
              rfaRevision: { id: 100, statusCode: { statusCode: 'DFT' } },
            },
          ],
        },
      });
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      const result = await service.findOneByUuid('rfa-uuid-1');

      expect(result.workflowInstanceId).toBeUndefined();
      expect(result.availableActions).toEqual([]);
    });
  });

  describe('findOneByUuidRaw', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        correspondenceRepo: { findOne: jest.fn() },
        rfaRepo: { findOne: jest.fn() },
      });
    });

    it('should resolve UUID and return raw RFA', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      const mockRfa = { id: 5, correspondence: { publicId: 'rfa-uuid-1' } };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);

      const result = await service.findOneByUuidRaw('rfa-uuid-1');

      expect(result).toEqual(mockRfa);
    });

    it('should throw NotFoundException when correspondence not found', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuidRaw('rfa-uuid-999')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        rfaRepo: { findOne: jest.fn() },
        corrRevRepo: { save: jest.fn() },
        taskCreationService: { createParallelTasks: jest.fn() },
        dataSource: {
          transaction: jest.fn(async (cb: (mgr: unknown) => Promise<unknown>) =>
            cb({})
          ),
        },
      });
    });

    it('should submit DRAFT RFA with existing workflow instance', async () => {
      const mockRfa = {
        id: 1,
        correspondence: {
          id: 10,
          projectId: 1,
          originatorId: 5,
          disciplineId: 3,
          correspondenceNumber: 'RFA-001',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              publicId: 'rev-uuid-1',
              subject: 'Test',
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                details: {},
              },
            },
          ],
        },
        rfaType: { typeCode: 'RFA' },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);
      workflowEngine.getInstanceByEntity.mockResolvedValue({
        id: 'wf-1',
        currentState: 'DRAFT',
      });
      workflowEngine.processTransition.mockResolvedValue({
        nextState: 'OWNER_APPROVAL',
        isCompleted: false,
        statusProjection: { rfa: 'SBO' },
      });
      rfaStatusRepo.findOne.mockResolvedValue({ id: 2, statusCode: 'SBO' });

      const result = await service.submit(1, baseUser);

      expect(workflowEngine.processTransition).toHaveBeenCalled();
      expect(result.currentState).toBe('OWNER_APPROVAL');
    });

    it('should self-heal when no workflow instance exists', async () => {
      const mockRfa = {
        id: 1,
        correspondence: {
          id: 10,
          projectId: 1,
          originatorId: 5,
          disciplineId: 3,
          correspondenceNumber: 'RFA-001',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              publicId: 'rev-uuid-1',
              subject: 'Test',
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                details: {},
              },
            },
          ],
        },
        rfaType: { typeCode: 'RFA' },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);
      workflowEngine.createInstance.mockResolvedValue({
        id: 'wf-new',
        currentState: 'DRAFT',
      });
      workflowEngine.processTransition.mockResolvedValue({
        nextState: 'OWNER_APPROVAL',
        isCompleted: false,
        statusProjection: { rfa: 'SBO' },
      });
      rfaStatusRepo.findOne.mockResolvedValue({ id: 2, statusCode: 'SBO' });

      await service.submit(1, baseUser);

      expect(workflowEngine.createInstance).toHaveBeenCalled();
    });

    it('should reject submission of non-DRAFT RFA', async () => {
      const mockRfa = {
        id: 1,
        correspondence: {
          id: 10,
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'SBO' },
                details: {},
              },
            },
          ],
        },
        rfaType: { typeCode: 'RFA' },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);

      await expect(service.submit(1, baseUser)).rejects.toThrow(
        WorkflowException
      );
    });

    it('should reject when already submitted (non-DRAFT workflow state)', async () => {
      const mockRfa = {
        id: 1,
        correspondence: {
          id: 10,
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                details: {},
              },
            },
          ],
        },
        rfaType: { typeCode: 'RFA' },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);
      workflowEngine.getInstanceByEntity.mockResolvedValue({
        id: 'wf-1',
        currentState: 'OWNER_APPROVAL',
      });

      await expect(service.submit(1, baseUser)).rejects.toThrow(
        WorkflowException
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        correspondenceRepo: { findOne: jest.fn() },
        rfaRepo: { findOne: jest.fn() },
        corrRevRepo: { save: jest.fn() },
      });
    });

    it('should update DRAFT RFA fields', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      const mockRfa = {
        id: 5,
        correspondence: {
          publicId: 'rfa-uuid-1',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              subject: 'Old',
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                details: {},
              },
            },
          ],
        },
      };
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue(mockRfa);
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      const dto: UpdateRfaDto = {
        subject: 'Updated Subject',
        body: 'New body',
      };
      const result = await service.update('rfa-uuid-1', dto, baseUser);

      expect(result).toBeDefined();
    });

    it('should reject update of non-DRAFT RFA', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue({
        id: 5,
        correspondence: {
          publicId: 'rfa-uuid-1',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'SBO' },
                details: {},
              },
            },
          ],
        },
      });

      await expect(
        service.update(
          'rfa-uuid-1',
          { subject: 'Fail' } as UpdateRfaDto,
          baseUser
        )
      ).rejects.toThrow(WorkflowException);
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      Object.assign(service as unknown as Record<string, unknown>, {
        correspondenceRepo: { findOne: jest.fn() },
        rfaRepo: { findOne: jest.fn() },
      });
    });

    it('should cancel DRAFT RFA and terminate workflow', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue({
        id: 5,
        correspondence: {
          correspondenceNumber: 'RFA-001',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                rfaStatusCodeId: 1,
              },
            },
          ],
        },
      });
      rfaStatusRepo.findOne.mockResolvedValue({ id: 99, statusCode: 'CC' });
      workflowEngine.getInstanceByEntity.mockResolvedValue({ id: 'wf-1' });
      workflowEngine.terminateInstance = jest.fn().mockResolvedValue(undefined);

      const result = await service.cancel('rfa-uuid-1', baseUser);

      expect(result.message).toBe('RFA cancelled successfully');
      expect(workflowEngine.terminateInstance).toHaveBeenCalled();
    });

    it('should cancel DRAFT RFA without workflow instance', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue({
        id: 5,
        correspondence: {
          correspondenceNumber: 'RFA-001',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'DFT' },
                rfaStatusCodeId: 1,
              },
            },
          ],
        },
      });
      rfaStatusRepo.findOne.mockResolvedValue({ id: 99, statusCode: 'CC' });
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      const result = await service.cancel('rfa-uuid-1', baseUser);

      expect(result.message).toBe('RFA cancelled successfully');
    });

    it('should reject cancel of non-DRAFT RFA', async () => {
      (
        service as unknown as { correspondenceRepo: { findOne: jest.Mock } }
      ).correspondenceRepo.findOne.mockResolvedValue({ id: 5 });
      (
        service as unknown as { rfaRepo: { findOne: jest.Mock } }
      ).rfaRepo.findOne.mockResolvedValue({
        id: 5,
        correspondence: {
          correspondenceNumber: 'RFA-001',
          revisions: [
            {
              id: 100,
              isCurrent: true,
              rfaRevision: {
                id: 200,
                statusCode: { statusCode: 'SBO' },
                rfaStatusCodeId: 2,
              },
            },
          ],
        },
      });

      await expect(service.cancel('rfa-uuid-1', baseUser)).rejects.toThrow(
        WorkflowException
      );
    });
  });

  describe('create', () => {
    const uuidResolver = {
      resolveProjectId: jest.fn(),
      resolveShopDrawingRevisionId: jest.fn(),
      resolveAsBuiltDrawingRevisionId: jest.fn(),
      resolveContractId: jest.fn(),
      resolveOrganizationId: jest.fn(),
    };
    const rfaTypeRepo = { findOne: jest.fn() };
    const correspondenceTypeRepo = { findOne: jest.fn() };
    const disciplineRepo = { findOne: jest.fn() };
    const orgRepo = { findOne: jest.fn() };
    const corrRevRepo = { save: jest.fn() };
    const correspondenceRepo = { save: jest.fn() };
    const rfaRepo = { save: jest.fn() };
    const numberingService = { generateNextNumber: jest.fn() };
    const searchService = { indexDocument: jest.fn() };
    const userService = { findOne: jest.fn() };

    const setupCreate = () => {
      const qr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
          createQueryBuilder: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
          }),
          findOne: jest.fn().mockResolvedValue({ id: 1, statusCode: 'DRAFT' }),
          create: jest
            .fn()
            .mockImplementation((_e: unknown, d: Record<string, unknown>) => ({
              ...d,
              id: 1,
            })),
          save: jest.fn().mockImplementation((entity: unknown) => entity),
        },
      };
      Object.assign(service as unknown as Record<string, unknown>, {
        uuidResolver,
        rfaTypeRepo,
        correspondenceTypeRepo,
        disciplineRepo,
        orgRepo,
        corrRevRepo,
        correspondenceRepo,
        rfaRepo,
        numberingService,
        searchService,
        userService,
        dataSource: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        hasSystemManageAllPermission: jest.fn().mockResolvedValue(false),
      });
      uuidResolver.resolveProjectId.mockResolvedValue(1);
      uuidResolver.resolveContractId.mockResolvedValue(10);
      uuidResolver.resolveOrganizationId.mockResolvedValue(5);
      uuidResolver.resolveShopDrawingRevisionId.mockResolvedValue(1);
      uuidResolver.resolveAsBuiltDrawingRevisionId.mockResolvedValue(1);
      rfaTypeRepo.findOne.mockResolvedValue({
        id: 1,
        typeCode: 'RFA',
        contractId: 10,
      });
      correspondenceTypeRepo.findOne.mockResolvedValue({
        id: 2,
        typeCode: 'RFA',
        isActive: true,
      });
      rfaStatusRepo.findOne.mockResolvedValue({ id: 1, statusCode: 'DFT' });
      orgRepo.findOne.mockResolvedValue({ organizationCode: 'ORG01' });
      numberingService.generateNextNumber.mockResolvedValue({
        number: 'RFA-0001',
      });
      rfaRepo.save.mockResolvedValue({ id: 1, publicId: 'rfa-new-uuid' });
      correspondenceRepo.save.mockResolvedValue({
        id: 1,
        publicId: 'corr-new-uuid',
      });
      corrRevRepo.save.mockResolvedValue({ id: 1, publicId: 'rev-new-uuid' });
      workflowEngine.createInstance.mockResolvedValue({ id: 'wf-new' });
      searchService.indexDocument.mockReturnValue({
        catch: jest.fn().mockResolvedValue(undefined),
      });
      return qr;
    };

    const baseCreateDto = {
      projectId: 'proj-uuid-1',
      rfaTypeId: 1,
      subject: 'Test RFA',
      contractId: 'contract-uuid-1',
    };

    const orgUser = {
      user_id: 1,
      publicId: 'user-uuid',
      primaryOrganizationId: 5,
    } as unknown as User;

    it('should create RFA successfully with workflow instance', async () => {
      setupCreate();
      const result = await service.create(baseCreateDto as never, orgUser);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          correspondenceNumber: { number: 'RFA-0001' },
        })
      );
      expect(workflowEngine.createInstance).toHaveBeenCalled();
    });

    it('should throw NotFoundException when RFA Type not found', async () => {
      setupCreate();
      rfaTypeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto as never, orgUser)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when Correspondence Type RFA not found', async () => {
      setupCreate();
      correspondenceTypeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto as never, orgUser)
      ).rejects.toThrow();
    });

    it('should throw when RFA Type contract mismatch', async () => {
      setupCreate();
      uuidResolver.resolveContractId.mockResolvedValue(999);

      await expect(
        service.create(baseCreateDto as never, orgUser)
      ).rejects.toThrow();
    });

    it('should throw when user has no organization', async () => {
      setupCreate();
      userService.findOne.mockResolvedValue({
        primaryOrganizationId: undefined,
      });
      const noOrgUser = {
        user_id: 1,
        publicId: 'user-uuid',
        primaryOrganizationId: undefined,
      } as unknown as User;

      await expect(
        service.create(baseCreateDto as never, noOrgUser)
      ).rejects.toThrow();
    });

    it('should validate drawing constraints for DDW type (requires shop drawing)', async () => {
      setupCreate();
      rfaTypeRepo.findOne.mockResolvedValue({
        id: 1,
        typeCode: 'DDW',
        contractId: 10,
      });

      // DDW without shopDrawingRevisionIds should throw
      await expect(
        service.create(
          { ...baseCreateDto, shopDrawingRevisionIds: [] } as never,
          orgUser
        )
      ).rejects.toThrow();
    });

    it('should rollback transaction on error', async () => {
      const qr = setupCreate();
      numberingService.generateNextNumber.mockRejectedValue(
        new Error('Numbering failed')
      );

      await expect(
        service.create(baseCreateDto as never, orgUser)
      ).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('should self-heal when workflow instance creation fails', async () => {
      setupCreate();
      workflowEngine.createInstance.mockRejectedValue(
        new Error('Workflow engine down')
      );

      // Should not throw — workflow creation failure is non-fatal
      const result = await service.create(baseCreateDto as never, orgUser);
      expect(result).toBeDefined();
    });
  });
});
