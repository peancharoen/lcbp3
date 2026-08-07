// File: backend/src/modules/migration/services/review-threshold.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit test for ReviewThresholdService (T022, FR-010)

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, FindOneOptions } from 'typeorm';
import Redis from 'ioredis';
import { ReviewThresholdService } from './review-threshold.service';
import { SystemSetting } from '../../ai/entities/system-setting.entity';
import {
  DEFAULT_REVIEW_THRESHOLDS,
  THRESHOLD_CACHE_KEY,
} from '../types/review-threshold.type';

describe('ReviewThresholdService', () => {
  let service: ReviewThresholdService;
  let redis: jest.Mocked<Redis>;
  let settingRepo: jest.Mocked<Repository<SystemSetting>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<Redis>;
    settingRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<SystemSetting>>;
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          findOne: jest.fn(),
          save: jest.fn().mockResolvedValue(undefined),
          create: jest.fn(<T>(_entity: unknown, data: T): T => data),
          query: jest.fn().mockResolvedValue(undefined),
        },
      }),
    } as unknown as jest.Mocked<DataSource>;

    const module = await Test.createTestingModule({
      providers: [
        ReviewThresholdService,
        { provide: getRepositoryToken(SystemSetting), useValue: settingRepo },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ReviewThresholdService>(ReviewThresholdService);
  });

  it('reads defaults when no settings exist in DB or cache', async () => {
    redis.get.mockResolvedValue(null);
    settingRepo.findOne.mockResolvedValue(null);

    const result = await service.getThresholds();

    expect(result.maxMismatchFields).toBe(
      DEFAULT_REVIEW_THRESHOLDS.maxMismatchFields
    );
    expect(result.minConfidence).toBe(DEFAULT_REVIEW_THRESHOLDS.minConfidence);
    expect(redis.set).toHaveBeenCalledWith(
      THRESHOLD_CACHE_KEY,
      expect.any(String),
      'EX',
      60
    );
  });

  it('reads from Redis cache when available', async () => {
    const cached = { maxMismatchFields: 5, minConfidence: 0.8 };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getThresholds();

    expect(result.maxMismatchFields).toBe(5);
    expect(result.minConfidence).toBe(0.8);
    expect(settingRepo.findOne).not.toHaveBeenCalled();
  });

  it('falls back to DB when cache is invalid JSON', async () => {
    redis.get.mockResolvedValue('not json');
    settingRepo.findOne.mockImplementation(
      (options: FindOneOptions<SystemSetting>) => {
        const where = options.where as { settingKey: string };
        if (where.settingKey === 'MIGRATION_MAX_MISMATCH_FIELDS') {
          return Promise.resolve({ settingValue: '7' } as SystemSetting);
        }
        if (where.settingKey === 'MIGRATION_MIN_CONFIDENCE') {
          return Promise.resolve({ settingValue: '0.9' } as SystemSetting);
        }
        return Promise.resolve(null);
      }
    );

    const result = await service.getThresholds();

    expect(result.maxMismatchFields).toBe(7);
    expect(result.minConfidence).toBe(0.9);
  });

  it('invalidates cache on update (DEL)', async () => {
    redis.get.mockResolvedValue(null);
    settingRepo.findOne.mockImplementation(
      (options: FindOneOptions<SystemSetting>) => {
        const where = options.where as { settingKey: string };
        if (where.settingKey === 'MIGRATION_MAX_MISMATCH_FIELDS') {
          return Promise.resolve({
            settingKey: where.settingKey,
            settingValue: '3',
          } as SystemSetting);
        }
        if (where.settingKey === 'MIGRATION_MIN_CONFIDENCE') {
          return Promise.resolve({
            settingKey: where.settingKey,
            settingValue: '0.6',
          } as SystemSetting);
        }
        return Promise.resolve(null);
      }
    );

    await service.updateThresholds({ maxMismatchFields: 1 }, 99);

    expect(redis.del).toHaveBeenCalledWith(THRESHOLD_CACHE_KEY);
  });

  it('rejects out-of-range maxMismatchFields', async () => {
    await expect(
      service.updateThresholds({ maxMismatchFields: 15 }, 1)
    ).rejects.toThrow();
  });

  it('rejects out-of-range minConfidence', async () => {
    await expect(
      service.updateThresholds({ minConfidence: -0.5 }, 1)
    ).rejects.toThrow();
  });

  it('rejects update with no fields provided', async () => {
    await expect(service.updateThresholds({}, 1)).rejects.toThrow();
  });
});
