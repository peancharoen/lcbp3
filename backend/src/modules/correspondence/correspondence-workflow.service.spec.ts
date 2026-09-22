// File: src/modules/correspondence/correspondence-workflow.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ CorrespondenceWorkflowService เพื่อทดสอบการเรียกใช้ RAG prepare job เมื่อสถานะเปลี่ยนจาก DRAFT (T017)
// - 2026-09-22: D344 — ตัด rag-prepare trigger ออกจาก status transition (dead code;
//   processor skip ทุก job อยู่แล้ว) — spec เหลือทดสอบ status sync ล้วน

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

describe('CorrespondenceWorkflowService', () => {
  let service: CorrespondenceWorkflowService;
  const mockWorkflowEngine = {
    createInstance: jest.fn(),
    processTransition: jest.fn(),
    getInstanceById: jest.fn(),
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
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrespondenceWorkflowService,
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
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
      ],
    }).compile();
    service = module.get<CorrespondenceWorkflowService>(
      CorrespondenceWorkflowService
    );
    jest.clearAllMocks();
  });
  describe('syncStatus', () => {
    it('ควร save revision ด้วย statusId ใหม่เมื่อ status เปลี่ยนจาก DRAFT', async () => {
      const mockStatus = { id: 2, statusCode: 'SUBOWN' };
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
            statusProjection: Record<string, unknown>
          ) => Promise<void>;
        }
      ).syncStatus(mockRevision as unknown as CorrespondenceRevision, {
        correspondence: 'SUBOWN',
      });
      expect(mockStatusRepo.findOne).toHaveBeenCalledWith({
        where: { statusCode: 'SUBOWN' },
      });
      expect(mockRevision.statusId).toBe(2);
      expect(mockRevisionRepo.manager.save).toHaveBeenCalledWith(mockRevision);
    });
    it('ควร save revision เมื่อสถานะเป็น DRAFT เช่นกัน', async () => {
      const mockStatus = { id: 1, statusCode: 'DRAFT' };
      mockStatusRepo.findOne.mockResolvedValueOnce(mockStatus);
      const mockRevision = {
        id: 50,
        correspondenceId: 100,
        revisionNumber: 0,
        subject: 'Test Subject',
        statusId: 99,
      };
      mockRevisionRepo.manager.save.mockResolvedValueOnce(mockRevision);
      await (
        service as unknown as {
          syncStatus: (
            revision: CorrespondenceRevision,
            statusProjection: Record<string, unknown>
          ) => Promise<void>;
        }
      ).syncStatus(mockRevision as unknown as CorrespondenceRevision, {
        correspondence: 'DRAFT',
      });
      expect(mockRevision.statusId).toBe(1);
      expect(mockRevisionRepo.manager.save).toHaveBeenCalledWith(mockRevision);
    });
    it('ไม่ควร save เมื่อไม่พบ status ใน DB', async () => {
      mockStatusRepo.findOne.mockResolvedValueOnce(null);
      const mockRevision = {
        id: 50,
        correspondenceId: 100,
        statusId: 1,
      };
      await (
        service as unknown as {
          syncStatus: (
            revision: CorrespondenceRevision,
            statusProjection: Record<string, unknown>
          ) => Promise<void>;
        }
      ).syncStatus(mockRevision as unknown as CorrespondenceRevision, {
        correspondence: 'UNKNOWN_STATUS',
      });
      expect(mockRevisionRepo.manager.save).not.toHaveBeenCalled();
    });
  });
});
