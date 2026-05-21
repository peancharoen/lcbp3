// File: src/modules/response-code/services/matrix-management.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ MatrixManagementService (T061, FR-022)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MatrixManagementService } from './matrix-management.service';
import { ResponseCodeRule } from '../entities/response-code-rule.entity';
import { ResponseCode } from '../entities/response-code.entity';

const mockCode = {
  id: 1,
  publicId: 'rc-uuid-1A',
  code: '1A',
  isSystem: false,
};
const mockSystemCode = { id: 2, publicId: 'rc-sys', code: '0', isSystem: true };
const mockExistingRule = {
  id: 10,
  publicId: 'rule-uuid-001',
  documentTypeId: 1,
  responseCodeId: 1,
  projectId: undefined,
  isEnabled: true,
  requiresComments: false,
  triggersNotification: false,
};

describe('MatrixManagementService', () => {
  let service: MatrixManagementService;
  const mockRuleRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockCodeRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatrixManagementService,
        {
          provide: getRepositoryToken(ResponseCodeRule),
          useValue: mockRuleRepo,
        },
        {
          provide: getRepositoryToken(ResponseCode),
          useValue: mockCodeRepo,
        },
      ],
    }).compile();
    service = module.get<MatrixManagementService>(MatrixManagementService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertRule', () => {
    it('ควร throw NotFoundException เมื่อ ResponseCode ไม่พบ', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.upsertRule({
          documentTypeId: 1,
          responseCodePublicId: 'not-found',
          isEnabled: true,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BadRequestException เมื่อพยายาม disable system code', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(mockSystemCode);
      await expect(
        service.upsertRule({
          documentTypeId: 1,
          responseCodePublicId: 'rc-sys',
          isEnabled: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('ควรอัปเดต existing rule (isEnabled, requiresComments)', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(mockCode);
      mockRuleRepo.findOne.mockResolvedValueOnce({ ...mockExistingRule });
      mockRuleRepo.save.mockResolvedValueOnce({
        ...mockExistingRule,
        isEnabled: false,
      });
      const result = await service.upsertRule({
        documentTypeId: 1,
        responseCodePublicId: 'rc-uuid-1A',
        isEnabled: false,
        requiresComments: true,
      });
      expect(mockRuleRepo.save).toHaveBeenCalledTimes(1);
      expect(result.isEnabled).toBe(false);
    });

    it('ควรสร้าง rule ใหม่เมื่อยังไม่มี', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(mockCode);
      mockRuleRepo.findOne.mockResolvedValueOnce(null); // ไม่มี existing
      const createdRule = {
        documentTypeId: 1,
        responseCodeId: 1,
        isEnabled: true,
        requiresComments: false,
        triggersNotification: false,
      };
      mockRuleRepo.create.mockReturnValueOnce(createdRule);
      mockRuleRepo.save.mockResolvedValueOnce(createdRule);
      const result = await service.upsertRule({
        documentTypeId: 1,
        responseCodePublicId: 'rc-uuid-1A',
        isEnabled: true,
      });
      expect(mockRuleRepo.create).toHaveBeenCalledTimes(1);
      expect(result.isEnabled).toBe(true);
    });

    it('ควร default requiresComments=false และ triggersNotification=false เมื่อสร้างใหม่', async () => {
      mockCodeRepo.findOne.mockResolvedValueOnce(mockCode);
      mockRuleRepo.findOne.mockResolvedValueOnce(null);
      mockRuleRepo.create.mockImplementation(
        (v: Partial<ResponseCodeRule>) => v
      );
      mockRuleRepo.save.mockImplementation((v: Partial<ResponseCodeRule>) =>
        Promise.resolve(v)
      );
      const result = await service.upsertRule({
        documentTypeId: 1,
        responseCodePublicId: 'rc-uuid-1A',
        isEnabled: true,
      });
      expect(result.requiresComments).toBe(false);
      expect(result.triggersNotification).toBe(false);
    });
  });

  describe('getRulesByDocType', () => {
    it('ควรดึง rules ของ documentType + projectId ที่ระบุ', async () => {
      mockRuleRepo.find.mockResolvedValueOnce([mockExistingRule]);
      const result = await service.getRulesByDocType(1, 5);
      expect(mockRuleRepo.find).toHaveBeenCalledWith({
        where: { documentTypeId: 1, projectId: 5 },
        relations: ['responseCode'],
      });
      expect(result).toHaveLength(1);
    });

    it('ควรดึง global rules เมื่อไม่ระบุ projectId', async () => {
      mockRuleRepo.find.mockResolvedValueOnce([mockExistingRule]);
      await service.getRulesByDocType(1);
      expect(mockRuleRepo.find).toHaveBeenCalledWith({
        where: { documentTypeId: 1, projectId: undefined },
        relations: ['responseCode'],
      });
    });
  });

  describe('deleteProjectOverride', () => {
    it('ควร throw NotFoundException เมื่อ rule ไม่พบ', async () => {
      mockRuleRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.deleteProjectOverride('nonexistent-rule')
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BadRequestException เมื่อพยายามลบ global rule', async () => {
      mockRuleRepo.findOne.mockResolvedValueOnce({
        ...mockExistingRule,
        projectId: undefined,
      });
      await expect(
        service.deleteProjectOverride('rule-uuid-001')
      ).rejects.toThrow(BadRequestException);
    });

    it('ควรลบ project override สำเร็จ', async () => {
      const projectRule = { ...mockExistingRule, projectId: 5 };
      mockRuleRepo.findOne.mockResolvedValueOnce(projectRule);
      mockRuleRepo.remove.mockResolvedValueOnce(undefined);
      await service.deleteProjectOverride('rule-uuid-001');
      expect(mockRuleRepo.remove).toHaveBeenCalledWith(projectRule);
    });
  });
});
