// File: src/modules/ai/intent-classifier/services/intent-definition.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit tests สำหรับ IntentDefinitionService (T014).

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntentDefinitionService } from './intent-definition.service';
import { IntentDefinition } from '../entities/intent-definition.entity';
import { IntentCategory } from '../interfaces/intent-category.enum';

describe('IntentDefinitionService', () => {
  let service: IntentDefinitionService;
  let repo: jest.Mocked<Repository<IntentDefinition>>;

  const mockDefinition: Partial<IntentDefinition> = {
    id: 1,
    publicId: 'uuid-1',
    intentCode: 'GET_RFA',
    descriptionTh: 'ดึง RFA',
    descriptionEn: 'Get RFA',
    category: IntentCategory.READ,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentDefinitionService,
        {
          provide: getRepositoryToken(IntentDefinition),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntentDefinitionService>(IntentDefinitionService);
    repo = module.get(getRepositoryToken(IntentDefinition));
  });

  describe('findAll', () => {
    it('ควรดึง definitions ทั้งหมด', async () => {
      repo.find.mockResolvedValue([mockDefinition as IntentDefinition]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: {},
        order: { intentCode: 'ASC' },
        relations: ['patterns'],
      });
    });

    it('ควร filter ตาม category', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ category: IntentCategory.SUGGEST });

      expect(repo.find).toHaveBeenCalledWith({
        where: { category: IntentCategory.SUGGEST },
        order: { intentCode: 'ASC' },
        relations: ['patterns'],
      });
    });

    it('ควร filter ตาม isActive', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ isActive: true });

      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { intentCode: 'ASC' },
        relations: ['patterns'],
      });
    });
  });

  describe('findByCode', () => {
    it('ควร return definition เมื่อเจอ', async () => {
      repo.findOne.mockResolvedValue(mockDefinition as IntentDefinition);

      const result = await service.findByCode('GET_RFA');

      expect(result.intentCode).toBe('GET_RFA');
    });

    it('ควร throw NotFoundException เมื่อไม่เจอ', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByCode('NOT_EXISTS')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('ควรสร้าง definition ใหม่สำเร็จ', async () => {
      repo.findOne.mockResolvedValue(null); // ไม่มี duplicate
      repo.create.mockReturnValue(mockDefinition as IntentDefinition);
      repo.save.mockResolvedValue(mockDefinition as IntentDefinition);

      const result = await service.create({
        intentCode: 'GET_RFA',
        descriptionTh: 'ดึง RFA',
        descriptionEn: 'Get RFA',
        category: IntentCategory.READ,
      });

      expect(result.intentCode).toBe('GET_RFA');
      expect(repo.save).toHaveBeenCalled();
    });

    it('ควร throw ConflictException เมื่อ intentCode ซ้ำ', async () => {
      repo.findOne.mockResolvedValue(mockDefinition as IntentDefinition);

      await expect(
        service.create({
          intentCode: 'GET_RFA',
          descriptionTh: 'ดึง RFA',
          descriptionEn: 'Get RFA',
          category: IntentCategory.READ,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('ควร update definition สำเร็จ', async () => {
      const updated = { ...mockDefinition, descriptionTh: 'อัปเดต' };
      repo.findOne.mockResolvedValue(mockDefinition as IntentDefinition);
      repo.save.mockResolvedValue(updated as IntentDefinition);

      const result = await service.update('GET_RFA', {
        descriptionTh: 'อัปเดต',
      });

      expect(result.descriptionTh).toBe('อัปเดต');
    });

    it('ควร throw NotFoundException เมื่อ intentCode ไม่มี', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('NOT_EXISTS', { descriptionTh: 'test' })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
