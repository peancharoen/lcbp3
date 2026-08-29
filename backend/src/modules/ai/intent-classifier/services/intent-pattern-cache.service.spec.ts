// File: backend/src/modules/ai/intent-classifier/services/intent-pattern-cache.service.spec.ts
// Change Log:
// - 2026-06-15: สร้าง unit test สำหรับ IntentPatternCacheService ครอบคลุม cache-aside pattern (ADR-024)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntentPatternCacheService } from './intent-pattern-cache.service';
import { IntentPattern } from '../entities/intent-pattern.entity';
import {
  PatternLanguage,
  PatternType,
} from '../interfaces/intent-category.enum';
import { CachedPattern } from '../interfaces/classification-result.interface';

/** Token ของ @nestjs-modules/ioredis — default Redis connection */
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/**
 * Unit tests สำหรับ IntentPatternCacheService
 * ครอบคลุม: getActivePatterns (cache hit/miss/redis error), invalidate (success/error),
 * loadAndCache (DB load + redis setex success/error)
 */
describe('IntentPatternCacheService', () => {
  let service: IntentPatternCacheService;
  let mockRedis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
  };
  let patternRepo: jest.Mocked<Repository<IntentPattern>>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const values: Record<string, unknown> = {
        INTENT_PATTERN_CACHE_TTL: 300,
      };
      return values[key] ?? defaultValue;
    }),
  };

  const mockPatterns: IntentPattern[] = [
    {
      id: 1,
      publicId: 'p-uuid-001',
      intentCode: 'GET_RFA',
      language: PatternLanguage.TH,
      patternType: PatternType.KEYWORD,
      patternValue: 'rfa',
      priority: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IntentPattern,
    {
      id: 2,
      publicId: 'p-uuid-002',
      intentCode: 'SUMMARIZE_DOCUMENT',
      language: PatternLanguage.ANY,
      patternType: PatternType.REGEX,
      patternValue: 'summar.*',
      priority: 20,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IntentPattern,
  ];

  const expectedCached: CachedPattern[] = [
    {
      publicId: 'p-uuid-001',
      intentCode: 'GET_RFA',
      language: 'th',
      patternType: 'keyword',
      patternValue: 'rfa',
      priority: 10,
    },
    {
      publicId: 'p-uuid-002',
      intentCode: 'SUMMARIZE_DOCUMENT',
      language: 'any',
      patternType: 'regex',
      patternValue: 'summar.*',
      priority: 20,
    },
  ];

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentPatternCacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getRepositoryToken(IntentPattern),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntentPatternCacheService>(IntentPatternCacheService);
    patternRepo = module.get(getRepositoryToken(IntentPattern));
    jest.clearAllMocks();
  });

  describe('getActivePatterns', () => {
    it('ควรคืน patterns จาก cache เมื่อมีใน Redis (cache hit)', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(expectedCached));

      const result = await service.getActivePatterns();

      expect(result).toHaveLength(2);
      expect(result[0].intentCode).toBe('GET_RFA');
      expect(result[1].intentCode).toBe('SUMMARIZE_DOCUMENT');
      expect(mockRedis.get).toHaveBeenCalledWith('ai:intent:patterns:active');
      expect(patternRepo.find).not.toHaveBeenCalled();
    });

    it('ควรโหลดจาก DB และ cache เมื่อไม่มีใน Redis (cache miss)', async () => {
      mockRedis.get.mockResolvedValue(null);
      patternRepo.find.mockResolvedValue(mockPatterns);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getActivePatterns();

      expect(result).toHaveLength(2);
      expect(result[0].publicId).toBe('p-uuid-001');
      expect(patternRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { priority: 'ASC' },
      });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ai:intent:patterns:active',
        300,
        JSON.stringify(expectedCached)
      );
    });

    it('ควร fallback ไป DB เมื่อ Redis get throw error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));
      patternRepo.find.mockResolvedValue(mockPatterns);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getActivePatterns();

      expect(result).toHaveLength(2);
      expect(patternRepo.find).toHaveBeenCalled();
    });

    it('ควรคืน patterns จาก DB แม้ setex ล้มเหลว (DB only)', async () => {
      mockRedis.get.mockResolvedValue(null);
      patternRepo.find.mockResolvedValue(mockPatterns);
      mockRedis.setex.mockRejectedValue(new Error('Redis write error'));

      const result = await service.getActivePatterns();

      expect(result).toHaveLength(2);
      expect(result[0].intentCode).toBe('GET_RFA');
    });

    it('ควรคืน empty array เมื่อ DB ไม่มี active patterns', async () => {
      mockRedis.get.mockResolvedValue(null);
      patternRepo.find.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getActivePatterns();

      expect(result).toHaveLength(0);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ai:intent:patterns:active',
        300,
        '[]'
      );
    });
  });

  describe('invalidate', () => {
    it('ควรลบ cache key สำเร็จ', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidate();

      expect(mockRedis.del).toHaveBeenCalledWith('ai:intent:patterns:active');
    });

    it('ควรไม่ throw เมื่อ redis.del ล้มเหลว', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.invalidate()).resolves.not.toThrow();
    });
  });

  describe('TTL configuration', () => {
    it('ควรใช้ค่า TTL จาก ConfigService', async () => {
      mockRedis.get.mockResolvedValue(null);
      patternRepo.find.mockResolvedValue(mockPatterns);
      mockRedis.setex.mockResolvedValue('OK');

      await service.getActivePatterns();

      // TTL ถูกอ่านใน constructor แล้ว clearAllMocks ล้างไปแล้ว ตรวจที่ setex แทน
      const ttlArg = (
        mockRedis.setex.mock.calls[0] as unknown[]
      )?.[1] as number;
      expect(ttlArg).toBe(300);
    });

    it('ควรใช้ default TTL 300 เมื่อ ConfigService ไม่มีค่า', async () => {
      // สร้าง service ใหม่ที่ไม่มี config value
      const noValueConfig = {
        get: jest.fn((key: string, defaultValue?: unknown): unknown => {
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          IntentPatternCacheService,
          { provide: ConfigService, useValue: noValueConfig },
          { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
          {
            provide: getRepositoryToken(IntentPattern),
            useValue: { find: jest.fn().mockResolvedValue(mockPatterns) },
          },
        ],
      }).compile();

      const customService = module.get<IntentPatternCacheService>(
        IntentPatternCacheService
      );
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');
      jest.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await customService.getActivePatterns();

      const ttlArg = (
        mockRedis.setex.mock.calls[0] as unknown[]
      )?.[1] as number;
      expect(ttlArg).toBe(300);
    });
  });
});
