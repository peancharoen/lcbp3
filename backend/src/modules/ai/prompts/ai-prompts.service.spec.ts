// File: backend/src/modules/ai/prompts/ai-prompts.service.spec.ts
// Change Log
// - 2026-05-25: Created unit tests for AiPromptsService (T028)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
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
        promptType: 'ocr_extraction',
        versionNumber: 6,
        template: 'Test {{ocr_text}}',
        isActive: false,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 12,
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
        promptType: 'ocr_extraction',
        versionNumber: 1,
        isActive: true,
      };
      const targetPrompt = {
        id: 2,
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
