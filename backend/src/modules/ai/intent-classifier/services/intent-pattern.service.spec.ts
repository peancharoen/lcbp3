// File: src/modules/ai/intent-classifier/services/intent-pattern.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit tests สำหรับ IntentPatternService (T015-T016).

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntentPatternService } from './intent-pattern.service';
import { IntentPattern } from '../entities/intent-pattern.entity';
import { IntentDefinition } from '../entities/intent-definition.entity';
import { IntentPatternCacheService } from './intent-pattern-cache.service';
import {
  PatternLanguage,
  PatternType,
} from '../interfaces/intent-category.enum';

describe('IntentPatternService', () => {
  let service: IntentPatternService;
  let patternRepo: jest.Mocked<Repository<IntentPattern>>;
  let definitionRepo: jest.Mocked<Repository<IntentDefinition>>;
  let cacheService: jest.Mocked<IntentPatternCacheService>;

  const mockPattern: Partial<IntentPattern> = {
    id: 1,
    publicId: 'p-uuid-1',
    intentCode: 'GET_RFA',
    language: PatternLanguage.TH,
    patternType: PatternType.KEYWORD,
    patternValue: 'rfa',
    priority: 10,
    isActive: true,
  };

  const mockDefinition: Partial<IntentDefinition> = {
    id: 1,
    publicId: 'def-uuid-1',
    intentCode: 'GET_RFA',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentPatternService,
        {
          provide: getRepositoryToken(IntentPattern),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(IntentDefinition),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: IntentPatternCacheService,
          useValue: {
            invalidate: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<IntentPatternService>(IntentPatternService);
    patternRepo = module.get(getRepositoryToken(IntentPattern));
    definitionRepo = module.get(getRepositoryToken(IntentDefinition));
    cacheService = module.get(IntentPatternCacheService);
  });

  describe('findByIntentCode', () => {
    it('ควรดึง patterns ตาม intentCode', async () => {
      patternRepo.find.mockResolvedValue([mockPattern as IntentPattern]);

      const result = await service.findByIntentCode('GET_RFA');

      expect(result).toHaveLength(1);
      expect(patternRepo.find).toHaveBeenCalledWith({
        where: { intentCode: 'GET_RFA' },
        order: { priority: 'ASC' },
      });
    });
  });

  describe('findByPublicId', () => {
    it('ควร return pattern เมื่อเจอ', async () => {
      patternRepo.findOne.mockResolvedValue(mockPattern as IntentPattern);

      const result = await service.findByPublicId('p-uuid-1');

      expect(result.publicId).toBe('p-uuid-1');
    });

    it('ควร throw NotFoundException เมื่อไม่เจอ', async () => {
      patternRepo.findOne.mockResolvedValue(null);

      await expect(service.findByPublicId('not-exists')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('ควรสร้าง pattern ใหม่สำเร็จ', async () => {
      definitionRepo.findOne.mockResolvedValue(
        mockDefinition as IntentDefinition
      );
      patternRepo.create.mockReturnValue(mockPattern as IntentPattern);
      patternRepo.save.mockResolvedValue(mockPattern as IntentPattern);

      const result = await service.create({
        intentCode: 'GET_RFA',
        patternType: PatternType.KEYWORD,
        patternValue: 'rfa',
      });

      expect(result.patternValue).toBe('rfa');
      expect(cacheService.invalidate).toHaveBeenCalled();
    });

    it('ควร throw NotFoundException เมื่อ intentCode ไม่มี', async () => {
      definitionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          intentCode: 'NOT_EXISTS',
          patternType: PatternType.KEYWORD,
          patternValue: 'test',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BadRequestException เมื่อ regex ไม่ถูกต้อง', async () => {
      definitionRepo.findOne.mockResolvedValue(
        mockDefinition as IntentDefinition
      );

      await expect(
        service.create({
          intentCode: 'GET_RFA',
          patternType: PatternType.REGEX,
          patternValue: '(?P<invalid',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('ควร validate regex ที่ถูกต้อง สำเร็จ', async () => {
      definitionRepo.findOne.mockResolvedValue(
        mockDefinition as IntentDefinition
      );
      patternRepo.create.mockReturnValue(mockPattern as IntentPattern);
      patternRepo.save.mockResolvedValue(mockPattern as IntentPattern);

      await expect(
        service.create({
          intentCode: 'GET_RFA',
          patternType: PatternType.REGEX,
          patternValue: 'rfa[- ]?\\d+',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('update', () => {
    it('ควร update pattern สำเร็จ + invalidate cache', async () => {
      const updated = { ...mockPattern, patternValue: 'new-value' };
      patternRepo.findOne.mockResolvedValue(mockPattern as IntentPattern);
      patternRepo.save.mockResolvedValue(updated as IntentPattern);

      const result = await service.update('p-uuid-1', {
        patternValue: 'new-value',
      });

      expect(result.patternValue).toBe('new-value');
      expect(cacheService.invalidate).toHaveBeenCalled();
    });

    it('ควร throw NotFoundException เมื่อ publicId ไม่มี', async () => {
      patternRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('not-exists', { patternValue: 'test' })
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร validate regex เมื่อเปลี่ยน patternValue เป็น regex', async () => {
      const regexPattern = {
        ...mockPattern,
        patternType: PatternType.REGEX,
        patternValue: 'old.*regex',
      };
      patternRepo.findOne.mockResolvedValue(regexPattern as IntentPattern);

      await expect(
        service.update('p-uuid-1', { patternValue: '(?P<bad' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('ควร soft delete (isActive=false) + invalidate cache', async () => {
      patternRepo.findOne.mockResolvedValue(mockPattern as IntentPattern);
      patternRepo.save.mockResolvedValue({
        ...mockPattern,
        isActive: false,
      } as IntentPattern);

      await service.remove('p-uuid-1');

      expect(patternRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
      expect(cacheService.invalidate).toHaveBeenCalled();
    });

    it('ควร throw NotFoundException เมื่อ publicId ไม่มี', async () => {
      patternRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('not-exists')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
