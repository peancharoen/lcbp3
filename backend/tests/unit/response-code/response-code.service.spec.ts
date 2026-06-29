// File: tests/unit/response-code/response-code.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCodeService } from '../../../src/modules/response-code/response-code.service';
import { ResponseCode } from '../../../src/modules/response-code/entities/response-code.entity';
import { ResponseCodeRule } from '../../../src/modules/response-code/entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../../../src/modules/common/enums/review.enums';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateResponseCodeDto } from '../../../src/modules/response-code/dto/create-response-code.dto';

describe('ResponseCodeService', () => {
  let service: ResponseCodeService;
  let repo: Repository<ResponseCode>;
  let _ruleRepo: Repository<ResponseCodeRule>;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRuleRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseCodeService,
        {
          provide: getRepositoryToken(ResponseCode),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ResponseCodeRule),
          useValue: mockRuleRepo,
        },
      ],
    }).compile();

    service = module.get<ResponseCodeService>(ResponseCodeService);
    repo = module.get<Repository<ResponseCode>>(
      getRepositoryToken(ResponseCode)
    );
    _ruleRepo = module.get<Repository<ResponseCodeRule>>(
      getRepositoryToken(ResponseCodeRule)
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active codes', async () => {
      const mockCodes = [{ code: '1A', isActive: true }];
      mockRepo.find.mockResolvedValue(mockCodes);
      const result = await service.findAll();
      expect(result).toEqual(mockCodes);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );
    });
  });

  describe('findByCategory', () => {
    it('should filter by category', async () => {
      const mockCodes = [
        { code: '1A', category: ResponseCodeCategory.ENGINEERING },
      ];
      mockRepo.find.mockResolvedValue(mockCodes);
      const result = await service.findByCategory(
        ResponseCodeCategory.ENGINEERING
      );
      expect(result).toEqual(mockCodes);
    });
  });

  describe('findByDocumentType', () => {
    it('should handle global and project rules with overrides and sorting', async () => {
      const globalRule1 = {
        responseCodeId: 2,
        projectId: null,
        responseCode: { id: 2, code: '2', isActive: true },
      };
      const globalRule2 = {
        responseCodeId: 1,
        projectId: null,
        responseCode: { id: 1, code: '1A', isActive: true },
      };
      const projectRule = {
        responseCodeId: 1,
        projectId: 10,
        responseCode: { id: 1, code: '1A_OVERRIDE', isActive: true },
      };

      mockRuleRepo.find.mockResolvedValue([
        globalRule1,
        globalRule2,
        projectRule,
      ]);

      const result = await service.findByDocumentType(1, 10);
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('1A_OVERRIDE');
      expect(result[1].code).toBe('2');
    });

    it('should ignore inactive codes from rules', async () => {
      const rule = {
        responseCodeId: 1,
        responseCode: { id: 1, code: '1A', isActive: false },
      };
      mockRuleRepo.find.mockResolvedValue([rule]);
      const result = await service.findByDocumentType(1);
      expect(result).toHaveLength(0);
    });
  });

  describe('findByPublicId', () => {
    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findByPublicId('none')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return code if found', async () => {
      const mockCode = { publicId: 'uuid' };
      mockRepo.findOne.mockResolvedValue(mockCode);
      const result = await service.findByPublicId('uuid');
      expect(result).toEqual(mockCode);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if already exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({
          code: '1A',
          category: ResponseCodeCategory.ENGINEERING,
        } as unknown as CreateResponseCodeDto)
      ).rejects.toThrow(ConflictException);
    });

    it('should create and save new code', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ code: '1A' });
      mockRepo.save.mockResolvedValue({ id: 1, code: '1A' });

      const result = await service.create({
        code: '1A',
        category: ResponseCodeCategory.ENGINEERING,
        isActive: true,
      } as unknown as CreateResponseCodeDto);
      expect(result.code).toBe('1A');
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw ConflictException if update creates a duplicate', async () => {
      const existing = {
        id: 1,
        publicId: 'uuid1',
        code: '1A',
        category: ResponseCodeCategory.ENGINEERING,
      };
      const duplicate = {
        id: 2,
        publicId: 'uuid2',
        code: '1B',
        category: ResponseCodeCategory.ENGINEERING,
      };

      mockRepo.findOne.mockResolvedValueOnce(existing); // findByPublicId
      mockRepo.findOne.mockResolvedValueOnce(duplicate); // check existing duplicate

      await expect(service.update('uuid1', { code: '1B' })).rejects.toThrow(
        ConflictException
      );
    });

    it('should update and save when no duplicate exists', async () => {
      const existing = { id: 1, publicId: 'uuid1', code: '1A' };
      mockRepo.findOne.mockResolvedValueOnce(existing);
      mockRepo.findOne.mockResolvedValueOnce(null); // No duplicate
      mockRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.update('uuid1', { descriptionEn: 'New' });
      expect(result.descriptionEn).toBe('New');
    });

    it('should handle update with same code and category (self-match)', async () => {
      const existing = {
        id: 1,
        publicId: 'uuid1',
        code: '1A',
        category: ResponseCodeCategory.ENGINEERING,
      };
      mockRepo.findOne.mockResolvedValueOnce(existing); // findByPublicId
      mockRepo.findOne.mockResolvedValueOnce(existing); // self match in check existing
      mockRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.update('uuid1', { descriptionEn: 'Same' });
      expect(result.descriptionEn).toBe('Same');
    });
  });

  describe('deactivate', () => {
    it('should throw BadRequestException for system codes', async () => {
      mockRepo.findOne.mockResolvedValue({ publicId: 'uuid', isSystem: true });
      await expect(service.deactivate('uuid')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should set isActive to false and save', async () => {
      const entity = { isSystem: false, isActive: true, publicId: 'uuid' };
      mockRepo.findOne.mockResolvedValue(entity);
      await service.deactivate('uuid');
      expect(entity.isActive).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('getNotifyRoles', () => {
    it('should return notifyRoles or empty array', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        publicId: 'uuid',
        notifyRoles: ['PM'],
      });
      expect(await service.getNotifyRoles('uuid')).toEqual(['PM']);

      mockRepo.findOne.mockResolvedValueOnce({
        publicId: 'uuid',
        notifyRoles: null,
      });
      expect(await service.getNotifyRoles('uuid')).toEqual([]);
    });
  });
});
