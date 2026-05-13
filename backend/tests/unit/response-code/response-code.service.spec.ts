// File: tests/unit/response-code/response-code.service.spec.ts
// Unit tests สำหรับ ResponseCodeService (T074)
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResponseCodeService } from '../../../src/modules/response-code/response-code.service';
import { ResponseCode } from '../../../src/modules/response-code/entities/response-code.entity';
import { ResponseCodeRule } from '../../../src/modules/response-code/entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../../../src/modules/common/enums/review.enums';

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
};

const mockRuleRepo = {
  find: jest.fn().mockResolvedValue([]),
};

describe('ResponseCodeService', () => {
  let service: ResponseCodeService;

  beforeEach(async () => {
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
});
