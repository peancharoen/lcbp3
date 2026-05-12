// File: tests/unit/delegation/circular-detection.service.spec.ts
// Unit tests สำหรับ CircularDetectionService — ป้องกัน delegation loops (T075)
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CircularDetectionService } from '../../../src/modules/delegation/services/circular-detection.service';
import { Delegation } from '../../../src/modules/delegation/entities/delegation.entity';

const mockDelegationRepo = {
  find: jest.fn(),
};

describe('CircularDetectionService', () => {
  let service: CircularDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircularDetectionService,
        { provide: getRepositoryToken(Delegation), useValue: mockDelegationRepo },
      ],
    }).compile();

    service = module.get<CircularDetectionService>(CircularDetectionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('wouldCreateCircle', () => {
    it('should return false when no delegations exist', async () => {
      mockDelegationRepo.find.mockResolvedValue([]);
      const result = await service.wouldCreateCircle(1, 2);
      expect(result).toBe(false);
    });

    it('should detect direct circular delegation A→B when B→A exists', async () => {
      // B (id=2) delegates to A (id=1)
      mockDelegationRepo.find.mockResolvedValue([
        { delegatorId: 2, delegateId: 1 },
      ]);
      // Now trying to add A→B — would create cycle
      const result = await service.wouldCreateCircle(1, 2);
      expect(result).toBe(true);
    });

    it('should detect indirect cycle A→B→C when trying C→A', async () => {
      // A→B and B→C already exist
      mockDelegationRepo.find.mockResolvedValue([
        { delegatorId: 1, delegateId: 2 },
        { delegatorId: 2, delegateId: 3 },
      ]);
      // Now trying C→A — would create A→B→C→A cycle
      const result = await service.wouldCreateCircle(3, 1);
      expect(result).toBe(true);
    });

    it('should return false for non-circular delegations', async () => {
      // A→B and B→C — adding D→A is fine
      mockDelegationRepo.find.mockResolvedValue([
        { delegatorId: 1, delegateId: 2 },
        { delegatorId: 2, delegateId: 3 },
      ]);
      const result = await service.wouldCreateCircle(4, 1);
      expect(result).toBe(false);
    });
  });
});
