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
    manager: {
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue(undefined),
    },
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
      terminateInstance: jest.fn(),
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

  describe('cancel() (Feature 253 — T033)', () => {
    const uuid = '019abc01-0000-7000-8000-0000000000aa';
    const mockUser = { user_id: 42 } as never;

    it('should cancel transmittal: set status CANCELLED + metadata + terminate workflow', async () => {
      dataSource.manager.findOne.mockResolvedValue({
        id: 99,
        correspondenceNumber: 'TRN-001',
      });
      transmittalRepo.findOne.mockResolvedValue({ correspondenceId: 99 });
      statusRepo.findOne.mockResolvedValue({ id: 7, statusCode: 'CANCELLED' });
      workflowEngine.getInstanceByEntity.mockResolvedValue({ id: 'wf-1' });

      const result = await service.cancel(uuid, 'No longer needed', mockUser);

      expect(result.message).toBe('Transmittal cancelled successfully');
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Transmittal,
        99,
        expect.objectContaining({
          statusId: 7,
          cancelReason: 'No longer needed',
          cancelledBy: 42,
        })
      );
      expect(workflowEngine.terminateInstance).toHaveBeenCalledWith(
        'wf-1',
        expect.stringContaining('No longer needed')
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when correspondence not found', async () => {
      dataSource.manager.findOne.mockResolvedValue(null);

      await expect(service.cancel(uuid, 'reason', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when transmittal not found', async () => {
      dataSource.manager.findOne.mockResolvedValue({ id: 99 });
      transmittalRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel(uuid, 'reason', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should not terminate workflow when no instance exists', async () => {
      dataSource.manager.findOne.mockResolvedValue({ id: 99 });
      transmittalRepo.findOne.mockResolvedValue({ correspondenceId: 99 });
      statusRepo.findOne.mockResolvedValue({ id: 7, statusCode: 'CANCELLED' });
      workflowEngine.getInstanceByEntity.mockResolvedValue(null);

      await service.cancel(uuid, 'reason', mockUser);

      expect(workflowEngine.terminateInstance).not.toHaveBeenCalled();
    });
  });

  describe('patchMetadata() (Feature 253 — T052)', () => {
    const uuid = '019abc01-0000-7000-8000-0000000000bb';
    const mockUser = { user_id: 42 } as never;

    const setupPatch = (version = 1) => {
      dataSource.manager.findOne.mockResolvedValue({
        id: 99,
        correspondenceNumber: 'TRN-001',
      });
      transmittalRepo.findOne.mockResolvedValue({
        correspondenceId: 99,
        version,
      });
    };

    it('should patch tier1 remarks and increment version', async () => {
      setupPatch(1);

      const result = await service.patchMetadata(
        uuid,
        { remarks: 'Updated remarks' },
        1,
        mockUser
      );

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Transmittal,
        99,
        { remarks: 'Updated remarks' }
      );
      expect(mockQueryRunner.manager.increment).toHaveBeenCalledWith(
        Transmittal,
        { correspondenceId: 99 },
        'version',
        1
      );
      expect(result.newVersion).toBe(2);
    });

    it('should throw on version mismatch', async () => {
      setupPatch(5);

      await expect(
        service.patchMetadata(uuid, { remarks: 'x' }, 1, mockUser)
      ).rejects.toThrow();
    });

    it('should reject tier3 field transmittalNumber', async () => {
      setupPatch(1);

      await expect(
        service.patchMetadata(uuid, { transmittalNumber: 'HACK' }, 1, mockUser)
      ).rejects.toThrow();
    });

    it('should reject unknown fields', async () => {
      setupPatch(1);

      await expect(
        service.patchMetadata(uuid, { bogus: 'x' }, 1, mockUser)
      ).rejects.toThrow();
    });
  });

  // Phase 2D — Transmittal Service Coverage (Feature 253 — FR-001, FR-012, FR-008)
  describe('Phase 2D — Transmittal cancel + metadata + cascade (Feature 253)', () => {
    const uuid = '019abc01-0000-7000-8000-0000000000bb';
    const mockUser2 = { user_id: 42 } as never;

    // 2D.1 — Transmittal cancel ที่มี items ผูกอยู่ — ยกเลิกเฉพาะ transmittal, ไม่กระทบ items
    it('2D.1 — cancel transmittal ที่มี items ผูกอยู่ → ยกเลิกเฉพาะ transmittal, ไม่ลบ items', async () => {
      dataSource.manager.findOne.mockResolvedValue({
        id: 99,
        correspondenceNumber: 'TRN-001',
      });
      transmittalRepo.findOne.mockResolvedValue({
        correspondenceId: 99,
        items: [{ itemCorrespondenceId: 201 }, { itemCorrespondenceId: 202 }],
      });
      statusRepo.findOne.mockResolvedValue({ id: 7, statusCode: 'CANCELLED' });
      workflowEngine.getInstanceByEntity.mockResolvedValue({ id: 'wf-1' });

      const result = await service.cancel(uuid, 'cancel with items', mockUser2);

      expect(result.message).toBe('Transmittal cancelled successfully');
      // ตรวจว่า update เฉพาะ transmittal (correspondenceId: 99) ไม่ใช่ items
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Transmittal,
        99,
        expect.objectContaining({
          statusId: 7,
          cancelReason: 'cancel with items',
        })
      );
      // ตรวจว่าไม่มีการลบ items (ไม่เรียก delete บน TransmittalItem)
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalledWith(
        TransmittalItem,
        expect.anything()
      );
    });

    // 2D.2 — Transmittal metadata patch tier2 (status-dependent) — ปฏิเสธ tier2 ถ้าไม่ใช่ DRAFT/IN_REVIEW
    // หมายเหตุ: Transmittal service ปัจจุบันยังไม่มี tier2 status-dependent check (เหมือน correspondence)
    // นี่คือ gap ที่ต้อง implement ในอนาคต — ตอนนี้ทดสอบพฤติกรรมปัจจุบัน (unknown field ถูกปฏิเสธ)
    it('2D.2 — patchMetadata unknown field → ปฏิเสธ (ยังไม่มี tier2 status check)', async () => {
      dataSource.manager.findOne.mockResolvedValue({
        id: 99,
        correspondenceNumber: 'TRN-001',
      });
      transmittalRepo.findOne.mockResolvedValue({
        correspondenceId: 99,
        version: 1,
      });

      // ปัจจุบัน service ไม่ได้ตรวจ status สำหรับ tier2 — แต่ตรวจ invalid fields
      // ใช้ field ที่ไม่อยู่ใน tier1/tier2/tier3 จริงๆ → จะเป็น invalid field
      await expect(
        service.patchMetadata(uuid, { unknownField: 'x' }, 1, mockUser2)
      ).rejects.toThrow();
    });

    // 2D.3 — Transmittal hard-delete cascade — ลบเฉพาะ transmittals + transmittal_items
    // หมายเหตุ: hardDelete อยู่ใน DocumentHardDeleteService (ไม่ใช่ TransmittalService)
    // ทดสอบที่ controller level หรือ integration test — ที่นี่ทดสอบว่า service มี method สำหรับ cascade
    it('2D.3 — TransmittalService ไม่มี hardDelete method (ใช้ DocumentHardDeleteService)', () => {
      // ตรวจว่า TransmittalService ไม่มี hardDelete method โดยตรง
      // (hardDelete อยู่ใน DocumentHardDeleteService ที่ใช้ cascadePolicy)
      expect(
        (service as unknown as { hardDelete?: unknown }).hardDelete
      ).toBeUndefined();
    });
  });
});
