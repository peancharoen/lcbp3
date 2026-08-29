// File: backend/src/modules/delegation/services/circular-detection.service.spec.ts
// Change Log:
// - 2026-08-26: Initial creation — unit tests for CircularDetectionService (FR-012)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CircularDetectionService } from './circular-detection.service';
import { Delegation } from '../entities/delegation.entity';

describe('CircularDetectionService', () => {
  let service: CircularDetectionService;
  let mockDelegationRepo: {
    createQueryBuilder: jest.Mock;
  };

  const makeQB = (delegations: Partial<Delegation>[]) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(delegations),
  });

  beforeEach(async () => {
    mockDelegationRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircularDetectionService,
        {
          provide: getRepositoryToken(Delegation),
          useValue: mockDelegationRepo,
        },
      ],
    }).compile();

    service = module.get<CircularDetectionService>(CircularDetectionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('wouldCreateCircle', () => {
    const today = new Date('2026-01-15');

    it('ควรคืน true เมื่อ proposedFrom === proposedTo (self-delegation)', async () => {
      const result = await service.wouldCreateCircle(1, 1, today);
      expect(result).toBe(true);
      expect(mockDelegationRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('ควรคืน false เมื่อไม่มี active delegations และไม่เป็น self-delegation', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(makeQB([]));
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(false);
    });

    it('ควรคืน false เมื่อ A→B เป็น edge ใหม่และไม่มี path กลับ', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 3, delegateUserId: 4 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(false);
    });

    it('ควรคืน true เมื่อ A→B และ B→A อยู่ใน active delegations (2-node cycle)', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 1 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(true);
    });

    it('ควรคืน true เมื่อ A→B→C→A (3-node cycle)', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 3 } as unknown as Delegation,
          { delegatorUserId: 3, delegateUserId: 1 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(true);
    });

    it('ควรคืน false เมื่อมี delegation chain แต่ไม่กลับมาที่ proposedFrom', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 3 } as unknown as Delegation,
          { delegatorUserId: 3, delegateUserId: 4 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(false);
    });

    it('ควรคืน true เมื่อมี cycle ยาว 4 nodes (A→B→C→D→A)', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 3 } as unknown as Delegation,
          { delegatorUserId: 3, delegateUserId: 4 } as unknown as Delegation,
          { delegatorUserId: 4, delegateUserId: 1 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(true);
    });

    it('ควรคืน false เมื่อ DFS เจอ node ที่เยี่ยมแล้วแต่ไม่ใช่ target (visited set ป้องกัน infinite loop)', async () => {
      // A→B, B→C, C→B (C วนกลับ B แต่ B ถูก visited แล้ว)
      // proposedFrom=1, proposedTo=2 → ตรวจจาก 2 ว่ากลับมา 1 ได้ไหม
      // path: 2→3→2 (visited 2 แล้ว) → false
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 3 } as unknown as Delegation,
          { delegatorUserId: 3, delegateUserId: 2 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(false);
    });

    it('ควรใช้ default today=now เมื่อไม่ส่ง today parameter', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(makeQB([]));
      const result = await service.wouldCreateCircle(1, 2);
      expect(result).toBe(false);
    });

    it('ควรคืน true เมื่อ proposedFrom มี delegation อยู่แล้วและสร้าง cycle', async () => {
      // existing: 1→3, 3→2
      // proposed: 1→2 → path 2→...→1? ไม่มี
      // แต่ถ้า existing: 2→3, 3→1 และ proposed 1→2 → cycle
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 3 } as unknown as Delegation,
          { delegatorUserId: 3, delegateUserId: 1 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(true);
    });

    it('ควรคืน false เมื่อมีหลาย delegations จาก user เดียวกันแต่ไม่เกิด cycle', async () => {
      mockDelegationRepo.createQueryBuilder.mockReturnValueOnce(
        makeQB([
          { delegatorUserId: 2, delegateUserId: 5 } as unknown as Delegation,
          { delegatorUserId: 2, delegateUserId: 6 } as unknown as Delegation,
          { delegatorUserId: 5, delegateUserId: 7 } as unknown as Delegation,
        ])
      );
      const result = await service.wouldCreateCircle(1, 2, today);
      expect(result).toBe(false);
    });
  });
});
