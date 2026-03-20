import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UuidResolverService } from './uuid-resolver.service';

// Mock uuid module to avoid ESM import issue with uuid@13
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str
    ),
  v7: () => '01912345-6789-7abc-8def-0123456789ab',
}));

describe('UuidResolverService', () => {
  let service: UuidResolverService;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UuidResolverService,
        {
          provide: DataSource,
          useValue: {
            manager: { query: mockQuery },
          },
        },
      ],
    }).compile();

    service = module.get<UuidResolverService>(UuidResolverService);
  });

  afterEach(() => jest.clearAllMocks());

  // ==========================================================
  // resolve() — Core generic resolver
  // ==========================================================

  describe('resolve()', () => {
    it('should return number directly when value is a number', async () => {
      const result = await service.resolve('Project', 'projects', 'id', 42);
      expect(result).toBe(42);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should parse numeric string and return number', async () => {
      const result = await service.resolve('Project', 'projects', 'id', '99');
      expect(result).toBe(99);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should look up UUID string and return PK from DB', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ id: 7 }]);

      const result = await service.resolve('Project', 'projects', 'id', uuid);
      expect(result).toBe(7);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `id` FROM `projects` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });

    it('should throw NotFoundException for invalid UUID string', async () => {
      await expect(
        service.resolve('Project', 'projects', 'id', 'not-a-uuid')
      ).rejects.toThrow(NotFoundException);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when UUID not found in DB', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([]);

      await expect(
        service.resolve('Project', 'projects', 'id', uuid)
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================
  // Named convenience resolvers
  // ==========================================================

  describe('resolveProjectId()', () => {
    it('should delegate to resolve with projects table', async () => {
      const result = await service.resolveProjectId(5);
      expect(result).toBe(5);
    });

    it('should look up UUID for project', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ id: 5 }]);

      const result = await service.resolveProjectId(uuid);
      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `id` FROM `projects` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });
  });

  describe('resolveOrganizationId()', () => {
    it('should delegate to resolve with organizations table', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ id: 3 }]);

      const result = await service.resolveOrganizationId(uuid);
      expect(result).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `id` FROM `organizations` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });
  });

  describe('resolveCorrespondenceId()', () => {
    it('should delegate to resolve with correspondences table', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ id: 10 }]);

      const result = await service.resolveCorrespondenceId(uuid);
      expect(result).toBe(10);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `id` FROM `correspondences` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });
  });

  describe('resolveUserId()', () => {
    it('should use user_id as PK column', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ user_id: 8 }]);

      const result = await service.resolveUserId(uuid);
      expect(result).toBe(8);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `user_id` FROM `users` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });
  });

  describe('resolveContractId()', () => {
    it('should delegate to resolve with contracts table', async () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      mockQuery.mockResolvedValue([{ id: 2 }]);

      const result = await service.resolveContractId(uuid);
      expect(result).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT `id` FROM `contracts` WHERE `uuid` = ? LIMIT 1',
        [uuid]
      );
    });
  });

  // ==========================================================
  // Edge cases
  // ==========================================================

  describe('edge cases', () => {
    it('should handle zero as a valid number', async () => {
      const result = await service.resolve('Project', 'projects', 'id', 0);
      expect(result).toBe(0);
    });

    it('should handle string "0" as numeric', async () => {
      const result = await service.resolve('Project', 'projects', 'id', '0');
      expect(result).toBe(0);
    });

    it('should handle negative number', async () => {
      const result = await service.resolve('Project', 'projects', 'id', -1);
      expect(result).toBe(-1);
    });
  });
});
