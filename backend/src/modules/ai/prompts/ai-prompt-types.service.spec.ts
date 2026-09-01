// File: backend/src/modules/ai/prompts/ai-prompt-types.service.spec.ts
// Change Log:
// - 2026-09-01: Created tests for AiPromptTypesService (Feature 251)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptType } from './ai-prompt-types.entity';
import { AiPromptTypesService } from './ai-prompt-types.service';
import { CreateAiPromptTypeDto } from './dto/create-ai-prompt-type.dto';
import {
  BusinessException,
  ConflictException,
} from '../../../common/exceptions';

type MockManager = {
  createQueryBuilder: jest.Mock;
  select: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  getRawOne: jest.Mock;
};

type MockRepository = Omit<
  Partial<Record<keyof Repository<AiPromptType>, jest.Mock>>,
  'manager'
> & {
  manager?: MockManager;
};

const createMockRepository = (): MockRepository =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    },
  }) as MockRepository;

describe('AiPromptTypesService', () => {
  let service: AiPromptTypesService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptTypesService,
        {
          provide: getRepositoryToken(AiPromptType),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<AiPromptTypesService>(AiPromptTypesService);
  });

  describe('findByType', () => {
    it('คืนค่า prompt type เมื่อพบในระบบ', async () => {
      const type = {
        id: 1,
        publicId: '0195...',
        promptType: 'ocr_extraction',
        displayName: 'สกัด Metadata จาก OCR',
      } as unknown as AiPromptType;
      repo.findOne?.mockResolvedValue(type);

      const result = await service.findByType('ocr_extraction');
      expect(result).toEqual(type);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { promptType: 'ocr_extraction', isActive: true },
      });
    });

    it('throw BusinessException เมื่อไม่พบ prompt type (FR-014)', async () => {
      repo.findOne?.mockResolvedValue(null);

      await expect(service.findByType('nonexistent')).rejects.toThrow(
        BusinessException
      );
    });
  });

  describe('findAll', () => {
    it('คืนรายการ active prompt types ทั้งหมด', async () => {
      const types = [
        { promptType: 'ocr_system', displayName: 'OCR' },
        { promptType: 'ocr_extraction', displayName: 'Extraction' },
      ] as unknown as AiPromptType[];
      repo.find?.mockResolvedValue(types);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { promptType: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('สร้าง prompt type ใหม่ได้เมื่อไม่ซ้ำ', async () => {
      const dto: CreateAiPromptTypeDto = {
        promptType: 'custom_type',
        displayName: 'Custom Type',
        description: 'test',
        expectedPlaceholders: ['foo'],
      };
      repo.findOne?.mockResolvedValue(null);
      repo.create?.mockReturnValue({});
      repo.save?.mockResolvedValue({
        publicId: '0195...',
        ...dto,
        isSystemManaged: false,
        isActive: true,
      } as unknown as AiPromptType);

      const result = await service.create(dto, 1);
      expect(result.promptType).toBe('custom_type');
    });

    it('throw ConflictException เมื่อ prompt_type ซ้ำ', async () => {
      const dto: CreateAiPromptTypeDto = {
        promptType: 'ocr_extraction',
        displayName: 'Dup',
      };
      repo.findOne?.mockResolvedValue({ id: 1 } as unknown as AiPromptType);

      await expect(service.create(dto, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('throw ConflictException เมื่อมี ai_prompts อ้างอิงอยู่ (FR-012)', async () => {
      repo.findOne?.mockResolvedValue({
        id: 1,
        promptType: 'custom_type',
        isSystemManaged: false,
      } as unknown as AiPromptType);
      repo.manager?.getRawOne.mockResolvedValue({ count: '3' });

      await expect(service.delete('custom_type')).rejects.toThrow(
        ConflictException
      );
    });

    it('throw BusinessException เมื่อพยายามลบ system-managed type (FR-013)', async () => {
      repo.findOne?.mockResolvedValue({
        id: 1,
        promptType: 'ocr_extraction',
        isSystemManaged: true,
      } as unknown as AiPromptType);

      await expect(service.delete('ocr_extraction')).rejects.toThrow(
        BusinessException
      );
    });
  });
});
