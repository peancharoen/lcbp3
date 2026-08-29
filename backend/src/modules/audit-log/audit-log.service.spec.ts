// File: backend/src/modules/audit-log/audit-log.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ AuditLogService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../../common/entities/audit-log.entity';

/**
 * Helper สร้าง mock QueryBuilder ที่ support chaining
 */
function createMockQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockAuditLogRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockAuditLogRepo = {
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated audit logs with defaults', async () => {
      const mockLogs = [
        { auditId: '1', action: 'CREATE', entityType: 'Correspondence' },
      ];
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([mockLogs, 1]),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.data).toEqual(mockLogs);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply entityName filter', async () => {
      const qb = createMockQueryBuilder();
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ entityName: 'Correspondence' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'audit_logs.entityName LIKE :entityName',
        { entityName: '%Correspondence%' }
      );
    });

    it('should apply action filter', async () => {
      const qb = createMockQueryBuilder();
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ action: 'CREATE' });

      expect(qb.andWhere).toHaveBeenCalledWith('audit_logs.action = :action', {
        action: 'CREATE',
      });
    });

    it('should apply userId filter', async () => {
      const qb = createMockQueryBuilder();
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ userId: 5 });

      expect(qb.andWhere).toHaveBeenCalledWith('audit_logs.userId = :userId', {
        userId: 5,
      });
    });

    it('should apply all filters together', async () => {
      const qb = createMockQueryBuilder();
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({
        entityName: 'Project',
        action: 'DELETE',
        userId: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });

    it('should calculate totalPages correctly', async () => {
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('should use custom page and limit', async () => {
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should not apply filters when not provided', async () => {
      const qb = createMockQueryBuilder();
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({});

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should handle zero results', async () => {
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
