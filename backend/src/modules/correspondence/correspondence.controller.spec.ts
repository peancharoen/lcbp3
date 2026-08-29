// File: backend/src/modules/correspondence/correspondence.controller.spec.ts
// Change Log:
// - 2026-09-15: Extended with processAction, previewNumber, findOne, update, getReferences,
//   addReference, removeReference, getTags, addTag, removeTag, bulkCancel, exportCsv,
//   cancel, hardDelete endpoint tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { CorrespondenceController } from './correspondence.controller';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ValidationException } from '../../common/exceptions';

describe('CorrespondenceController', () => {
  let controller: CorrespondenceController;
  let mockCorrespondenceService: Partial<CorrespondenceService>;
  let mockWorkflowService: Partial<CorrespondenceWorkflowService>;

  beforeEach(async () => {
    mockCorrespondenceService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneByUuid: jest.fn(),
      update: jest.fn(),
      getReferences: jest.fn(),
      addReference: jest.fn(),
      removeReference: jest.fn(),
      getTags: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      bulkCancel: jest.fn(),
      exportCsv: jest.fn(),
      cancel: jest.fn(),
      hardDelete: jest.fn(),
      previewDocumentNumber: jest.fn(),
    };

    mockWorkflowService = {
      submitWorkflow: jest.fn(),
      processAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrespondenceController],
      providers: [
        {
          provide: CorrespondenceService,
          useValue: mockCorrespondenceService,
        },
        {
          provide: CorrespondenceWorkflowService,
          useValue: mockWorkflowService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CorrespondenceController>(CorrespondenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processAction', () => {
    it('should extract roles and call workflowService.processAction', async () => {
      const actionDto = {
        instanceId: 'inst-1',
        action: 'APPROVE',
        comment: 'Approved',
        payload: { key: 'value' },
      };
      const mockReq = {
        user: {
          user_id: 1,
          assignments: [
            { role: { roleName: 'CONTRACTOR' } },
            { role: { roleName: 'ENGINEER' } },
          ],
        },
      };
      const mockResult = { success: true };
      (mockWorkflowService.processAction as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await controller.processAction(
        actionDto,
        mockReq as Parameters<typeof controller.processAction>[1]
      );

      expect(mockWorkflowService.processAction).toHaveBeenCalledWith(
        'inst-1',
        1,
        {
          action: 'APPROVE',
          comment: 'Approved',
          payload: { key: 'value', roles: ['CONTRACTOR', 'ENGINEER'] },
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw ValidationException when instanceId is missing', () => {
      const actionDto = { action: 'APPROVE', comment: 'ok' };
      const mockReq = { user: { user_id: 1 } };

      expect(() =>
        controller.processAction(
          actionDto as Parameters<typeof controller.processAction>[0],
          mockReq as Parameters<typeof controller.processAction>[1]
        )
      ).toThrow(ValidationException);
    });

    it('should handle empty assignments gracefully', async () => {
      const actionDto = { instanceId: 'inst-1', action: 'REJECT' };
      const mockReq = { user: { user_id: 1 } };
      (mockWorkflowService.processAction as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await controller.processAction(
        actionDto,
        mockReq as Parameters<typeof controller.processAction>[1]
      );

      expect(mockWorkflowService.processAction).toHaveBeenCalledWith(
        'inst-1',
        1,
        {
          action: 'REJECT',
          comment: undefined,
          payload: { roles: [] },
        }
      );
    });
  });

  describe('create', () => {
    it('should create a correspondence', async () => {
      const mockCorr = { id: 1, correspondenceNumber: 'TEST-001' };
      (mockCorrespondenceService.create as jest.Mock).mockResolvedValue(
        mockCorr
      );

      const mockReq = { user: { user_id: 1 } };
      const createDto = { projectId: 1, typeId: 1, subject: 'Test Subject' };

      const result = await controller.create(
        createDto as Parameters<typeof controller.create>[0],
        mockReq as Parameters<typeof controller.create>[1]
      );

      expect(mockCorrespondenceService.create).toHaveBeenCalledWith(
        createDto,
        mockReq.user
      );
      expect(result).toEqual(mockCorr);
    });
  });

  describe('previewNumber', () => {
    it('should call previewDocumentNumber with DTO and user', async () => {
      const mockResult = { number: 'PREVIEW-001' };
      (
        mockCorrespondenceService.previewDocumentNumber as jest.Mock
      ).mockResolvedValue(mockResult);

      const mockReq = { user: { user_id: 1 } };
      const dto = { projectId: 1, typeId: 1, subject: 'Test' };

      const result = await controller.previewNumber(
        dto as Parameters<typeof controller.previewNumber>[0],
        mockReq as Parameters<typeof controller.previewNumber>[1]
      );

      expect(
        mockCorrespondenceService.previewDocumentNumber
      ).toHaveBeenCalledWith(dto, mockReq.user);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findAll', () => {
    it('should return correspondences', async () => {
      const mockResult = [{ id: 1 }];
      (mockCorrespondenceService.findAll as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await controller.findAll({});

      expect(mockCorrespondenceService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('submit', () => {
    it('should submit a correspondence to workflow', async () => {
      const mockResult = { instanceId: 'inst-1', currentState: 'IN_REVIEW' };
      (mockWorkflowService.submitWorkflow as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = {
        user: {
          user_id: 1,
          assignments: [{ role: { roleName: 'CONTRACTOR' } }],
        },
      };
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 1,
      });

      const result = await controller.submit(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        { note: 'Test note' },
        mockReq as Parameters<typeof controller.submit>[2]
      );

      expect(mockWorkflowService.submitWorkflow).toHaveBeenCalledWith(
        1,
        1,
        ['CONTRACTOR'],
        'Test note'
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call findOneByUuid with uuid', async () => {
      const mockCorr = { id: 1, publicId: 'uuid-123' };
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue(
        mockCorr
      );

      const result = await controller.findOne('uuid-123');

      expect(mockCorrespondenceService.findOneByUuid).toHaveBeenCalledWith(
        'uuid-123'
      );
      expect(result).toEqual(mockCorr);
    });
  });

  describe('update', () => {
    it('should find by uuid then call update with internal id', async () => {
      const mockCorr = { id: 42, publicId: 'uuid-123' };
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue(
        mockCorr
      );
      const mockResult = { id: 42, updated: true };
      (mockCorrespondenceService.update as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = { user: { user_id: 1 } };
      const dto = { subject: 'Updated' };

      const result = await controller.update(
        'uuid-123',
        dto as Parameters<typeof controller.update>[1],
        mockReq as Parameters<typeof controller.update>[2]
      );

      expect(mockCorrespondenceService.update).toHaveBeenCalledWith(
        42,
        dto,
        mockReq.user
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getReferences', () => {
    it('should find by uuid then call getReferences with internal id', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 5,
      });
      const mockRefs = { outgoing: [], incoming: [] };
      (mockCorrespondenceService.getReferences as jest.Mock).mockResolvedValue(
        mockRefs
      );

      const result = await controller.getReferences('uuid-123');

      expect(mockCorrespondenceService.getReferences).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockRefs);
    });
  });

  describe('addReference', () => {
    it('should find by uuid then call addReference with internal id', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 5,
      });
      const mockRef = { id: 10 };
      (mockCorrespondenceService.addReference as jest.Mock).mockResolvedValue(
        mockRef
      );
      const dto = { targetUuid: 'target-uuid' };

      const result = await controller.addReference('uuid-123', dto);

      expect(mockCorrespondenceService.addReference).toHaveBeenCalledWith(
        5,
        dto
      );
      expect(result).toEqual(mockRef);
    });
  });

  describe('removeReference', () => {
    it('should find both source and target then call removeReference', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock)
        .mockResolvedValueOnce({ id: 5 })
        .mockResolvedValueOnce({ id: 10 });
      (
        mockCorrespondenceService.removeReference as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.removeReference('uuid-123', 'target-uuid');

      expect(mockCorrespondenceService.removeReference).toHaveBeenCalledWith(
        5,
        10
      );
    });
  });

  describe('getTags', () => {
    it('should find by uuid then call getTags with internal id', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 5,
      });
      const mockTags = [{ id: 1, name: 'Important' }];
      (mockCorrespondenceService.getTags as jest.Mock).mockResolvedValue(
        mockTags
      );

      const result = await controller.getTags('uuid-123');

      expect(mockCorrespondenceService.getTags).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockTags);
    });
  });

  describe('addTag', () => {
    it('should find by uuid then call addTag with internal id and tagId', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 5,
      });
      const mockTagRow = { id: 1, correspondenceId: 5, tagId: 3 };
      (mockCorrespondenceService.addTag as jest.Mock).mockResolvedValue(
        mockTagRow
      );

      const result = await controller.addTag('uuid-123', 3);

      expect(mockCorrespondenceService.addTag).toHaveBeenCalledWith(5, 3);
      expect(result).toEqual(mockTagRow);
    });
  });

  describe('removeTag', () => {
    it('should find by uuid then call removeTag with internal id and tagId', async () => {
      (mockCorrespondenceService.findOneByUuid as jest.Mock).mockResolvedValue({
        id: 5,
      });
      (mockCorrespondenceService.removeTag as jest.Mock).mockResolvedValue(
        undefined
      );

      await controller.removeTag('uuid-123', 3);

      expect(mockCorrespondenceService.removeTag).toHaveBeenCalledWith(5, 3);
    });
  });

  describe('bulkCancel', () => {
    it('should call bulkCancel with uuids, reason, and user', async () => {
      const mockResult = {
        succeeded: ['uuid-1'],
        failed: ['uuid-2'],
      };
      (mockCorrespondenceService.bulkCancel as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = { user: { user_id: 1 } };
      const dto = { uuids: ['uuid-1', 'uuid-2'], reason: 'Batch cancel' };

      const result = await controller.bulkCancel(
        dto,
        mockReq as Parameters<typeof controller.bulkCancel>[1]
      );

      expect(mockCorrespondenceService.bulkCancel).toHaveBeenCalledWith(
        ['uuid-1', 'uuid-2'],
        'Batch cancel',
        mockReq.user
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('exportCsv', () => {
    it('should set headers and send CSV with BOM', async () => {
      const csvContent = 'Document No.,Subject\nDOC-001,Test';
      (mockCorrespondenceService.exportCsv as jest.Mock).mockResolvedValue(
        csvContent
      );

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.exportCsv({}, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('correspondences-')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('\uFEFF')
      );
    });
  });

  describe('cancel', () => {
    it('should call cancel with uuid, reason, and user', async () => {
      const mockResult = { success: true, message: 'Cancelled' };
      (mockCorrespondenceService.cancel as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = { user: { user_id: 1 } };
      const dto = { reason: 'No longer needed' };

      const result = await controller.cancel(
        'uuid-123',
        dto,
        mockReq as Parameters<typeof controller.cancel>[2]
      );

      expect(mockCorrespondenceService.cancel).toHaveBeenCalledWith(
        'uuid-123',
        'No longer needed',
        mockReq.user
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('hardDelete', () => {
    it('should call hardDelete with uuid and user', async () => {
      const mockResult = {
        deletedCorrespondence: true,
        deletedAttachmentCount: 3,
        vectorDeletionJobsEnqueued: 1,
      };
      (mockCorrespondenceService.hardDelete as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = { user: { user_id: 1 } };

      const result = await controller.hardDelete(
        'uuid-123',
        mockReq as Parameters<typeof controller.hardDelete>[1]
      );

      expect(mockCorrespondenceService.hardDelete).toHaveBeenCalledWith(
        'uuid-123',
        mockReq.user
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when hardDelete fails', async () => {
      (mockCorrespondenceService.hardDelete as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      const mockReq = { user: { user_id: 1 } };

      await expect(
        controller.hardDelete(
          'uuid-123',
          mockReq as Parameters<typeof controller.hardDelete>[1]
        )
      ).rejects.toThrow('Permission denied');
    });
  });
});
