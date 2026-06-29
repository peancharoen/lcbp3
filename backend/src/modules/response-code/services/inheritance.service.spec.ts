// File: src/modules/response-code/services/inheritance.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ InheritanceService (T062, FR-021)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InheritanceService } from './inheritance.service';
import { ResponseCodeRule } from '../entities/response-code-rule.entity';

// Helper สร้าง mock rule
const makeRule = (
  id: number,
  responseCodeId: number,
  publicId: string,
  projectId?: number,
  overrides: Record<string, unknown> = {}
): Partial<ResponseCodeRule> => ({
  id,
  responseCodeId,
  documentTypeId: 1,
  projectId,
  isEnabled: true,
  requiresComments: false,
  triggersNotification: false,
  responseCode: { publicId } as unknown as ResponseCodeRule['responseCode'],
  ...overrides,
});

describe('InheritanceService', () => {
  let service: InheritanceService;
  const mockRuleRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InheritanceService,
        {
          provide: getRepositoryToken(ResponseCodeRule),
          useValue: mockRuleRepo,
        },
      ],
    }).compile();
    service = module.get<InheritanceService>(InheritanceService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveMatrix — global only', () => {
    it('ควรคืน global rules เมื่อไม่ระบุ projectId', async () => {
      const globalRules = [makeRule(1, 10, 'rc-1A'), makeRule(2, 20, 'rc-2')];
      mockRuleRepo.find.mockResolvedValueOnce(globalRules);
      const result = await service.resolveMatrix(1);
      expect(result).toHaveLength(2);
      expect(result[0].isOverridden).toBe(false);
      expect(result[0].responseCodePublicId).toBe('rc-1A');
    });

    it('ควรคืน array ว่างเมื่อไม่มี global rules', async () => {
      mockRuleRepo.find.mockResolvedValueOnce([]);
      const result = await service.resolveMatrix(99);
      expect(result).toHaveLength(0);
    });
  });

  describe('resolveMatrix — with project overrides', () => {
    it('ควร merge: project rule ชนะ global rule ของ responseCode เดียวกัน', async () => {
      const globalRules = [makeRule(1, 10, 'rc-1A')];
      const projectRules = [
        makeRule(2, 10, 'rc-1A-override', 5, {
          isEnabled: false,
          requiresComments: true,
        }),
      ];
      // เรียก find สองครั้ง: global, project
      mockRuleRepo.find
        .mockResolvedValueOnce(globalRules)
        .mockResolvedValueOnce(projectRules);
      const result = await service.resolveMatrix(1, 5);
      expect(result).toHaveLength(1);
      expect(result[0].isOverridden).toBe(true);
      expect(result[0].isEnabled).toBe(false);
      expect(result[0].requiresComments).toBe(true);
      expect(result[0].parentRuleId).toBe(1); // global rule id
    });

    it('ควรใช้ global rule เมื่อ project ไม่ override', async () => {
      const globalRules = [makeRule(1, 10, 'rc-1A'), makeRule(2, 20, 'rc-2')];
      const projectRules: Partial<ResponseCodeRule>[] = []; // ไม่มี override
      mockRuleRepo.find
        .mockResolvedValueOnce(globalRules)
        .mockResolvedValueOnce(projectRules);
      const result = await service.resolveMatrix(1, 5);
      expect(result).toHaveLength(2);
      expect(result[0].isOverridden).toBe(false);
      expect(result[0].parentRuleId).toBeUndefined();
    });

    it('ควรเพิ่ม project-only rule ที่ไม่มี global parent', async () => {
      const globalRules = [makeRule(1, 10, 'rc-1A')];
      const projectRules = [
        makeRule(1, 10, 'rc-1A'), // overlap กับ global
        makeRule(3, 30, 'rc-extra', 5), // project-only (responseCodeId=30 ไม่มีใน global)
      ];
      mockRuleRepo.find
        .mockResolvedValueOnce(globalRules)
        .mockResolvedValueOnce(projectRules);
      const result = await service.resolveMatrix(1, 5);
      // 1 merged + 1 project-only = 2
      expect(result).toHaveLength(2);
      const extra = result.find((r) => r.responseCodeId === 30);
      expect(extra).toBeDefined();
      expect(extra?.isOverridden).toBe(true);
      expect(extra?.parentRuleId).toBeUndefined();
    });
  });
});
