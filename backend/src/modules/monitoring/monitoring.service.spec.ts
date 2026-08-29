// File: backend/src/modules/monitoring/monitoring.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ MonitoringService

import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';

// Token ของ @nestjs-modules/ioredis — default Redis connection
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMaintenanceStatus', () => {
    it('should return enabled=true when redis returns "true"', async () => {
      mockRedis.get.mockResolvedValue('true');

      const result = await service.getMaintenanceStatus();

      expect(mockRedis.get).toHaveBeenCalledWith('system:maintenance_mode');
      expect(result.isEnabled).toBe(true);
      expect(result.message).toBe('System is under maintenance');
    });

    it('should return enabled=false when redis returns null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getMaintenanceStatus();

      expect(result.isEnabled).toBe(false);
      expect(result.message).toBe('System is normal');
    });

    it('should return enabled=false when redis returns other value', async () => {
      mockRedis.get.mockResolvedValue('false');

      const result = await service.getMaintenanceStatus();

      expect(result.isEnabled).toBe(false);
      expect(result.message).toBe('System is normal');
    });
  });

  describe('setMaintenanceMode', () => {
    it('should enable maintenance mode with reason', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('true');

      const result = await service.setMaintenanceMode({
        enabled: true,
        reason: 'System upgrade',
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'system:maintenance_mode',
        'true'
      );
      expect(result.isEnabled).toBe(true);
    });

    it('should enable maintenance mode without reason', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('true');

      const result = await service.setMaintenanceMode({ enabled: true });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'system:maintenance_mode',
        'true'
      );
      expect(result.isEnabled).toBe(true);
    });

    it('should disable maintenance mode', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.setMaintenanceMode({ enabled: false });

      expect(mockRedis.del).toHaveBeenCalledWith('system:maintenance_mode');
      expect(result.isEnabled).toBe(false);
    });
  });
});
