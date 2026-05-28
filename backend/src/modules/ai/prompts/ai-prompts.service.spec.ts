// File: backend/src/modules/ai/prompts/ai-prompts.service.spec.ts
// Change Log
// - 2026-05-25: Created unit tests for AiPromptsService (T028)
// - 2026-05-27: Added resolveContext and project isolation security tests (T013)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { AiPromptsService } from './ai-prompts.service';
import { AiPrompt } from './ai-prompts.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import {
  BusinessException,
  ValidationException,
  NotFoundException,
} from '../../../common/exceptions';

describe('AiPromptsService', () => {
  let service: AiPromptsService;
  const mockAiPromptRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    },
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    },
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        {
          provide: getRepositoryToken(AiPrompt),
          useValue: mockAiPromptRepo,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();
    service = module.get<AiPromptsService>(AiPromptsService);
  });
  describe('resolveContext', () => {
    it('ควรดึงข้อมูล Master Data ได้ครบถ้วนเมื่อไม่มี project filter และ override', async () => {
      const activePrompt = {
        id: 1,
        publicId: 'prompt-uuid-123',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        template: 'Test template',
        fieldSchema: null,
        isActive: true,
        contextConfig: { filter: {} },
        testResultJson: null,
        manualNote: null,
        lastTestedAt: null,
        activatedAt: null,
        createdBy: 1,
        createdAt: new Date(),
      } as AiPrompt;
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { projectCode: 'LCB3', uuid: 'proj-123', projectName: 'LCP Phase 3' },
        ])
        .mockResolvedValueOnce([
          {
            organizationCode: 'OWN',
            uuid: 'org-456',
            organizationName: 'Owner',
          },
        ])
        .mockResolvedValueOnce([
          { disciplineCode: 'GEN', codeNameTh: 'General' },
        ])
        .mockResolvedValueOnce([
          { typeCode: 'RFA', typeName: 'Request for Approval' },
        ])
        .mockResolvedValueOnce([{ tagName: 'TagA', colorCode: '#FFF' }]);
      const result = await service.resolveContext(activePrompt);
      expect(result.availableProjects).toEqual([
        { code: 'LCB3', uuid: 'proj-123', name: 'LCP Phase 3' },
      ]);
      expect(result.availableOrganizations).toEqual([
        { code: 'OWN', uuid: 'org-456', name: 'Owner' },
      ]);
      expect(result.availableDisciplines).toEqual([
        { code: 'GEN', name: 'General' },
      ]);
      expect(result.availableCorrespondenceTypes).toEqual([
        { code: 'RFA', name: 'Request for Approval' },
      ]);
      expect(result.availableTags).toEqual([{ name: 'TagA', color: '#FFF' }]);
    });
    it('ควร throw NotFoundException เมื่อส่ง override project UUID ที่ไม่มีอยู่ใน DB', async () => {
      const activePrompt = {
        id: 1,
        publicId: 'prompt-uuid-456',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        template: 'Test template',
        fieldSchema: null,
        isActive: true,
        contextConfig: {},
        testResultJson: null,
        manualNote: null,
        lastTestedAt: null,
        activatedAt: null,
        createdBy: 1,
        createdAt: new Date(),
      } as AiPrompt;
      mockQueryBuilder.getRawOne.mockResolvedValue(null);
      await expect(
        service.resolveContext(activePrompt, 'non-existent-uuid')
      ).rejects.toThrow(NotFoundException);
    });
    it('ควร throw ForbiddenException เมื่อพยายาม override ข้ามโครงการที่ถูกล็อคไว้ใน template', async () => {
      const activePrompt = {
        id: 1,
        publicId: 'prompt-uuid-789',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        template: 'Test template',
        fieldSchema: null,
        isActive: true,
        contextConfig: {
          filter: {
            projectId: 1,
          },
        },
        testResultJson: null,
        manualNote: null,
        lastTestedAt: null,
        activatedAt: null,
        createdBy: 1,
        createdAt: new Date(),
      } as AiPrompt;
      mockQueryBuilder.getRawOne.mockResolvedValue({ id: 2 });
      await expect(
        service.resolveContext(activePrompt, 'another-project-uuid')
      ).rejects.toThrow(ForbiddenException);
    });
    it('ควรผ่านเมื่อ override project UUID ตรงกับ projectId ที่ล็อคไว้ใน template', async () => {
      const activePrompt = {
        id: 1,
        publicId: 'prompt-uuid-abc',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        template: 'Test template',
        fieldSchema: null,
        isActive: true,
        contextConfig: {
          filter: {
            projectId: 1,
          },
        },
        testResultJson: null,
        manualNote: null,
        lastTestedAt: null,
        activatedAt: null,
        createdBy: 1,
        createdAt: new Date(),
      } as AiPrompt;
      mockQueryBuilder.getRawOne.mockResolvedValue({ id: 1 });
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { projectCode: 'LCB3', uuid: 'proj-123', projectName: 'LCP Phase 3' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await service.resolveContext(activePrompt, 'matched-uuid');
      expect(result.availableProjects).toBeDefined();
    });
  });
  describe('create', () => {
    it('ควรปฏิเสธ template ที่ไม่มี {{ocr_text}} placeholder', async () => {
      await expect(
        service.create(
          'ocr_extraction',
          { template: 'Invalid prompt structure' },
          1
        )
      ).rejects.toThrow(ValidationException);
    });
    it('ควรปฏิเสธ template ที่ตัวอักษรเกิน 4,000 ตัว', async () => {
      const longTemplate = 'a'.repeat(4005) + '{{ocr_text}}';
      await expect(
        service.create('ocr_extraction', { template: longTemplate }, 1)
      ).rejects.toThrow(ValidationException);
    });
    it('ควรบันทึกสำเร็จและรัน version number ต่อเนื่อง', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: 5 });
      mockAiPromptRepo.create.mockReturnValue({
        id: 12,
        publicId: 'prompt-uuid-new',
        promptType: 'ocr_extraction',
        versionNumber: 6,
        template: 'Test {{ocr_text}}',
        isActive: false,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 12,
        publicId: 'prompt-uuid-new',
        promptType: 'ocr_extraction',
        versionNumber: 6,
        template: 'Test {{ocr_text}}',
        isActive: false,
      });
      const result = await service.create(
        'ocr_extraction',
        { template: 'Test {{ocr_text}}' },
        1
      );
      expect(result.versionNumber).toBe(6);
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });
  });
  describe('activate', () => {
    it('ควร activate สำเร็จ ยกเลิกตัวอื่น และลบ cache', async () => {
      const activePrompt = {
        id: 1,
        publicId: 'prompt-uuid-active',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        isActive: true,
      };
      const targetPrompt = {
        id: 2,
        publicId: 'prompt-uuid-target',
        promptType: 'ocr_extraction',
        versionNumber: 2,
        isActive: false,
      };
      mockQueryRunner.manager.findOne.mockResolvedValue(targetPrompt);
      mockQueryRunner.manager.find.mockResolvedValue([activePrompt]);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...targetPrompt,
        isActive: true,
      });
      const result = await service.activate('ocr_extraction', 2, 1);
      expect(result.isActive).toBe(true);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        AiPrompt,
        { promptType: 'ocr_extraction', isActive: true },
        { isActive: false }
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai:prompt:active:ocr_extraction'
      );
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });
    it('ควร throw error เมื่อไม่พบ prompt version ที่ต้องการ activate', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(service.activate('ocr_extraction', 99, 1)).rejects.toThrow(
        NotFoundException
      );
    });
  });
  describe('delete', () => {
    it('ควร throw error เมื่อลบ active version', async () => {
      mockAiPromptRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'prompt-uuid-del',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        isActive: true,
      });
      await expect(service.delete('ocr_extraction', 1, 1)).rejects.toThrow(
        BusinessException
      );
    });
    it('ควรลบ inactive version สำเร็จและบันทึก audit log', async () => {
      const inactivePrompt = {
        id: 2,
        publicId: 'prompt-uuid-inactive',
        promptType: 'ocr_extraction',
        versionNumber: 2,
        isActive: false,
      };
      mockAiPromptRepo.findOne.mockResolvedValue(inactivePrompt);
      await service.delete('ocr_extraction', 2, 1);
      expect(mockAiPromptRepo.remove).toHaveBeenCalledWith(inactivePrompt);
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });
  });
  describe('getActive', () => {
    it('ควรดึงจาก Redis cache เมื่อมี cache hit', async () => {
      const cachedPrompt = {
        id: 1,
        publicId: 'prompt-uuid-cache',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        isActive: true,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPrompt));
      const result = await service.getActive('ocr_extraction');
      expect(result).toEqual(cachedPrompt);
      expect(mockAiPromptRepo.findOne).not.toHaveBeenCalled();
    });
    it('ควร fallback ไปหา DB เมื่อ Redis มีปัญหา', async () => {
      const dbPrompt = {
        id: 1,
        publicId: 'prompt-uuid-db',
        promptType: 'ocr_extraction',
        versionNumber: 1,
        isActive: true,
      };
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));
      mockAiPromptRepo.findOne.mockResolvedValue(dbPrompt);
      const result = await service.getActive('ocr_extraction');
      expect(result).toEqual(dbPrompt);
      expect(mockAiPromptRepo.findOne).toHaveBeenCalled();
    });
  });
});
