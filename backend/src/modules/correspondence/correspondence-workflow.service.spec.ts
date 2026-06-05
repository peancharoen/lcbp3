// File: src/modules/correspondence/correspondence-workflow.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ CorrespondenceWorkflowService เพื่อทดสอบการเรียกใช้ RAG prepare job เมื่อสถานะเปลี่ยนจาก DRAFT (T017)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { AiQueueService } from '../ai/ai-queue.service';

describe('CorrespondenceWorkflowService', () => {
  let service: CorrespondenceWorkflowService;
  let aiQueueService: AiQueueService;
  const mockWorkflowEngine = {
    createInstance: jest.fn(),
    processTransition: jest.fn(),
    getInstanceById: jest.fn(),
  };
  const mockCorrespondenceRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockRevisionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    },
  };
  const mockStatusRepo = {
    findOne: jest.fn(),
  };
  const mockRecipientRepo = {
    find: jest.fn(),
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockRevisionRepo.manager,
    }),
  };
  const mockNotificationService = {
    send: jest.fn(),
  };
  const mockUserService = {
    findDocControlIdByOrg: jest.fn(),
  };
  const mockAiQueueService = {
    enqueueRagPrepare: jest.fn().mockResolvedValue('job-id-123'),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrespondenceWorkflowService,
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
        {
          provide: getRepositoryToken(Correspondence),
          useValue: mockCorrespondenceRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useValue: mockRevisionRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: mockStatusRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRecipient),
          useValue: mockRecipientRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
        { provide: AiQueueService, useValue: mockAiQueueService },
      ],
    }).compile();
    service = module.get<CorrespondenceWorkflowService>(
      CorrespondenceWorkflowService
    );
    aiQueueService = module.get<AiQueueService>(AiQueueService);
    jest.clearAllMocks();
  });
  describe('syncStatus RAG trigger', () => {
    it('ควรเรียก enqueueRagPrepare เมื่อสถานะเอกสารถูกเปลี่ยนจาก DRAFT เป็นอย่างอื่น', async () => {
      const mockStatus = { id: 2, statusCode: 'SUBOWN' };
      mockStatusRepo.findOne.mockResolvedValueOnce(mockStatus);
      const mockProject = { id: 10, publicId: 'proj-uuid-123' };
      const mockCorrespondence = {
        id: 100,
        publicId: 'doc-uuid-999',
        correspondenceNumber: 'CORR-001',
        projectId: 10,
        project: mockProject,
        type: { correspondenceTypeCode: 'LETTER' },
      };
      const mockRevision = {
        id: 50,
        correspondenceId: 100,
        revisionNumber: 0,
        subject: 'Test Subject',
        documentDate: new Date('2026-06-05'),
        correspondence: mockCorrespondence,
        statusId: 1,
      };
      mockRevisionRepo.manager.save.mockResolvedValueOnce(mockRevision);
      mockRevisionRepo.manager.find.mockResolvedValueOnce([
        {
          correspondenceRevisionId: 50,
          attachmentId: 88,
          isMainDocument: true,
          attachment: { filePath: '/files/doc.pdf', fileExtension: 'pdf' },
        },
      ]);
      await (
        service as unknown as {
          syncStatus: (
            revision: CorrespondenceRevision,
            workflowState: string
          ) => Promise<void>;
        }
      ).syncStatus(
        mockRevision as unknown as CorrespondenceRevision,
        'IN_REVIEW'
      );
      expect(mockRevisionRepo.manager.save).toHaveBeenCalledWith(mockRevision);
      expect(aiQueueService.enqueueRagPrepare).toHaveBeenCalledWith({
        documentPublicId: 'doc-uuid-999',
        projectPublicId: 'proj-uuid-123',
        correspondenceNumber: 'CORR-001',
        docType: 'LETTER',
        statusCode: 'SUBOWN',
        revisionNumber: 0,
        subject: 'Test Subject',
        documentDate: '2026-06-05',
        attachmentPath: '/files/doc.pdf',
      });
    });
    it('ไม่ควรเรียก enqueueRagPrepare เมื่อเอกสารยังคงอยู่ในสถานะ DRAFT', async () => {
      const mockStatus = { id: 1, statusCode: 'DRAFT' };
      mockStatusRepo.findOne.mockResolvedValueOnce(mockStatus);
      const mockRevision = {
        id: 50,
        correspondenceId: 100,
        revisionNumber: 0,
        subject: 'Test Subject',
        statusId: 1,
      };
      mockRevisionRepo.manager.save.mockResolvedValueOnce(mockRevision);
      await (
        service as unknown as {
          syncStatus: (
            revision: CorrespondenceRevision,
            workflowState: string
          ) => Promise<void>;
        }
      ).syncStatus(mockRevision as unknown as CorrespondenceRevision, 'DRAFT');
      expect(mockRevisionRepo.manager.save).toHaveBeenCalledWith(mockRevision);
      expect(aiQueueService.enqueueRagPrepare).not.toHaveBeenCalled();
    });
  });
});
