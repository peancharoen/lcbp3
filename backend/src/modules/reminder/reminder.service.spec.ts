// File: backend/src/modules/reminder/reminder.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ ReminderService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { ReminderRule } from './entities/reminder-rule.entity';
import { ReminderHistory } from './entities/reminder-history.entity';
import { Project } from '../project/entities/project.entity';
import { ReviewTask } from '../review-team/entities/review-task.entity';
import { ReminderType } from '../common/enums/review.enums';

// Mock uuidValidate ให้ return true/false ตามที่กำหนด
jest.mock('uuid', () => ({
  validate: jest.fn((val: string) => val === 'valid-uuid' || val.length === 36),
  v4: jest.fn(() => 'mock-uuid'),
  v7: jest.fn(() => 'mock-uuid-v7'),
}));

describe('ReminderService', () => {
  let service: ReminderService;
  let mockRuleRepo: Record<string, jest.Mock>;
  let mockHistoryRepo: Record<string, jest.Mock>;
  let mockProjectRepo: Record<string, jest.Mock>;
  let mockTaskRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRuleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn(),
      remove: jest.fn(),
    };
    mockHistoryRepo = {
      find: jest.fn(),
    };
    mockProjectRepo = {
      findOne: jest.fn(),
    };
    mockTaskRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getRepositoryToken(ReminderRule), useValue: mockRuleRepo },
        {
          provide: getRepositoryToken(ReminderHistory),
          useValue: mockHistoryRepo,
        },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(ReviewTask), useValue: mockTaskRepo },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return rules filtered by projectId when provided', async () => {
      const mockRules = [
        { id: 1, projectId: 10, name: 'Rule 1' },
        { id: 2, projectId: undefined, name: 'Global Rule' },
      ];
      mockRuleRepo.find.mockResolvedValue(mockRules);

      const result = await service.findAll(10);

      expect(mockRuleRepo.find).toHaveBeenCalledWith({
        where: [{ projectId: 10 }, { projectId: undefined }],
        order: { escalationLevel: 'ASC', daysBeforeDue: 'DESC' },
      });
      expect(result).toEqual(mockRules);
    });

    it('should return all rules when projectId is undefined', async () => {
      const mockRules = [{ id: 1, name: 'Rule 1' }];
      mockRuleRepo.find.mockResolvedValue(mockRules);

      const result = await service.findAll();

      expect(mockRuleRepo.find).toHaveBeenCalledWith({
        order: { escalationLevel: 'ASC' },
      });
      expect(result).toEqual(mockRules);
    });
  });

  describe('findAllByProjectPublicId', () => {
    it('should return all rules when projectPublicId is not provided', async () => {
      const mockRules = [{ id: 1, name: 'Rule 1' }];
      mockRuleRepo.find.mockResolvedValue(mockRules);

      const result = await service.findAllByProjectPublicId();

      expect(result).toEqual(mockRules);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        service.findAllByProjectPublicId('invalid-uuid')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findAllByProjectPublicId('valid-uuid')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return rules for valid project UUID', async () => {
      mockProjectRepo.findOne.mockResolvedValue({
        id: 10,
        publicId: 'valid-uuid',
      });
      const mockRules = [{ id: 1, projectId: 10, name: 'Rule 1' }];
      mockRuleRepo.find.mockResolvedValue(mockRules);

      const result = await service.findAllByProjectPublicId('valid-uuid');

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'valid-uuid' },
      });
      expect(result).toEqual(mockRules);
    });
  });

  describe('findOne', () => {
    it('should return a rule by publicId', async () => {
      const mockRule = { id: 1, publicId: 'uuid-1', name: 'Rule 1' };
      mockRuleRepo.findOne.mockResolvedValue(mockRule);

      const result = await service.findOne('uuid-1');

      expect(mockRuleRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-1' },
      });
      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException when rule not found', async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findHistoryByTaskPublicId', () => {
    it('should return history for a valid task', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 5, publicId: 'task-uuid' });
      const mockHistory = [
        { id: 1, taskId: 5, userId: 1, reminderType: ReminderType.EMAIL },
      ];
      mockHistoryRepo.find.mockResolvedValue(mockHistory);

      const result = await service.findHistoryByTaskPublicId('task-uuid');

      expect(mockTaskRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'task-uuid' },
      });
      expect(mockHistoryRepo.find).toHaveBeenCalledWith({
        where: { taskId: 5 },
        relations: ['user'],
        order: { sentAt: 'DESC' },
      });
      expect(result).toEqual(mockHistory);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findHistoryByTaskPublicId('nonexistent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and save a new rule', async () => {
      const dto = {
        name: 'New Rule',
        reminderType: ReminderType.EMAIL,
        daysBeforeDue: 3,
      };
      const savedRule = { id: 1, ...dto };
      mockRuleRepo.save.mockResolvedValue(savedRule);

      const result = await service.create(dto);

      expect(mockRuleRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRuleRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedRule);
    });
  });

  describe('update', () => {
    it('should update and save an existing rule', async () => {
      const existingRule = {
        id: 1,
        publicId: 'uuid-1',
        name: 'Old Name',
        daysBeforeDue: 3,
      };
      mockRuleRepo.findOne.mockResolvedValue(existingRule);
      mockRuleRepo.save.mockResolvedValue({
        ...existingRule,
        name: 'New Name',
      });

      const result = await service.update('uuid-1', { name: 'New Name' });

      expect(mockRuleRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException when rule not found for update', async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an existing rule', async () => {
      const mockRule = { id: 1, publicId: 'uuid-1', name: 'Rule 1' };
      mockRuleRepo.findOne.mockResolvedValue(mockRule);
      mockRuleRepo.remove.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      expect(mockRuleRepo.remove).toHaveBeenCalledWith(mockRule);
    });

    it('should throw NotFoundException when rule not found for removal', async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
