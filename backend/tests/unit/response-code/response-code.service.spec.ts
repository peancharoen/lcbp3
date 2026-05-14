// File: tests/unit/response-code/response-code.service.spec.ts
// Unit tests สำหรับ ResponseCodeService (T074)
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResponseCodeService } from '../../../src/modules/response-code/response-code.service';
import { ResponseCode } from '../../../src/modules/response-code/entities/response-code.entity';
import { ResponseCodeRule } from '../../../src/modules/response-code/entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../../../src/modules/common/enums/review.enums';
import { BadRequestException, ConflictException } from '@nestjs/common';

const mockCode: Partial<ResponseCode> = {
  id: 1,
  publicId: 'test-uuid-1',
  code: '1A',
  category: ResponseCodeCategory.ENGINEERING,
  descriptionTh: 'ผ่าน — ไม่มีเงื่อนไข',
  descriptionEn: 'Approved — No Comments',
  isActive: true,
  isSystem: true,
};

const mockCodeRepo = {
  find: jest.fn().mockResolvedValue([mockCode]),
  findOne: jest.fn().mockResolvedValue(mockCode),
  create: jest.fn(
    (payload: Partial<ResponseCode>): Partial<ResponseCode> => payload
  ),
  save: jest.fn(
    (payload: Partial<ResponseCode>): Promise<Partial<ResponseCode>> =>
      Promise.resolve(payload)
  ),
};

const mockRuleRepo = {
  find: jest.fn().mockResolvedValue([]),
};

describe('ResponseCodeService', () => {
  let service: ResponseCodeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCodeRepo.find.mockResolvedValue([mockCode]);
    mockCodeRepo.findOne.mockResolvedValue(mockCode);
    mockCodeRepo.create.mockImplementation(
      (payload: Partial<ResponseCode>): Partial<ResponseCode> => payload
    );
    mockCodeRepo.save.mockImplementation(
      (payload: Partial<ResponseCode>): Promise<Partial<ResponseCode>> =>
        Promise.resolve(payload)
    );
    mockRuleRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseCodeService,
        { provide: getRepositoryToken(ResponseCode), useValue: mockCodeRepo },
        {
          provide: getRepositoryToken(ResponseCodeRule),
          useValue: mockRuleRepo,
        },
      ],
    }).compile();

    service = module.get<ResponseCodeService>(ResponseCodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByCategory', () => {
    it('should return codes filtered by category', async () => {
      const result = await service.findByCategory(
        ResponseCodeCategory.ENGINEERING
      );
      expect(mockCodeRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: ResponseCodeCategory.ENGINEERING,
          }),
        })
      );
      expect(result).toEqual([mockCode]);
    });
  });

  describe('findByDocumentType', () => {
    it('should return enabled codes for document type', async () => {
      const result = await service.findByDocumentType(1, 1);
      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a non-system response code when code/category is unique', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.create({
        code: '9A',
        category: ResponseCodeCategory.ENGINEERING,
        descriptionTh: 'ทดสอบ',
        descriptionEn: 'Test',
      });

      expect(mockCodeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: '9A',
          category: ResponseCodeCategory.ENGINEERING,
          isSystem: false,
          isActive: true,
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          code: '9A',
          category: ResponseCodeCategory.ENGINEERING,
          isSystem: false,
        })
      );
    });

    it('should reject duplicate code/category pairs', async () => {
      await expect(
        service.create({
          code: '1A',
          category: ResponseCodeCategory.ENGINEERING,
          descriptionTh: 'ซ้ำ',
          descriptionEn: 'Duplicate',
        })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('should update an existing response code by publicId', async () => {
      const result = await service.update('test-uuid-1', {
        descriptionEn: 'Updated Description',
      });

      expect(mockCodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          publicId: 'test-uuid-1',
          descriptionEn: 'Updated Description',
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          descriptionEn: 'Updated Description',
        })
      );
    });
  });

  describe('deactivate', () => {
    it('should reject deactivation for system response codes', async () => {
      await expect(service.deactivate('test-uuid-1')).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });
});
