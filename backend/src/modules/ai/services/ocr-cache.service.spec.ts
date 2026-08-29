// File: backend/src/modules/ai/services/ocr-cache.service.spec.ts
// Change Log:
// - 2026-06-15: สร้าง unit test สำหรับ OcrCacheService ครอบคลุม get/set/invalidate/exists และ error paths (T007, ADR-032)

import { Test, TestingModule } from '@nestjs/testing';
import { OcrCacheService, CachedOcrResult } from './ocr-cache.service';

/** Token ของ @nestjs-modules/ioredis — default Redis connection */
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/**
 * Unit tests สำหรับ OcrCacheService
 * ครอบคลุม: get (hit/miss/error), set (success/error), invalidate (success/error), exists
 */
describe('OcrCacheService', () => {
  let service: OcrCacheService;
  let mockRedis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
  };

  const cachedResult: CachedOcrResult = {
    text: 'extracted text content',
    engineUsed: 'np-dms-ocr',
    charCount: 22,
    cachedAt: '2026-06-15T00:00:00.000Z',
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrCacheService,
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<OcrCacheService>(OcrCacheService);
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('ควรคืน CachedOcrResult เมื่อมี cache', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.get('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('extracted text content');
      expect(result?.engineUsed).toBe('np-dms-ocr');
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('ควรคืน null เมื่อไม่มี cache (redis คืน null)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBeNull();
    });

    it('ควรคืน null เมื่อ JSON.parse ล้มเหลว (cache corruption)', async () => {
      mockRedis.get.mockResolvedValue('{invalid json');

      const result = await service.get('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBeNull();
    });

    it('ควรคืน null เมื่อ redis.get throw error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.get('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBeNull();
    });

    it('ควรใช้ key ที่แตกต่างกันสำหรับ engine ต่างกัน', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get('/tmp/test.pdf', 'np-dms-ocr');
      await service.get('/tmp/test.pdf', 'np-dms-ai');

      // สอง key ต้องไม่เหมือนกัน
      const firstKey = (
        mockRedis.get.mock.calls[0] as unknown[]
      )?.[0] as string;
      const secondKey = (
        mockRedis.get.mock.calls[1] as unknown[]
      )?.[0] as string;
      expect(firstKey).not.toBe(secondKey);
      expect(firstKey).toContain('ai:ocr:result:');
      expect(secondKey).toContain('ai:ocr:result:');
    });
  });

  describe('set', () => {
    it('ควรบันทึก cache สำเร็จ พร้อม TTL 24 ชั่วโมง', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('/tmp/test.pdf', 'np-dms-ocr', {
        text: 'new text',
        engineUsed: 'np-dms-ocr',
        charCount: 8,
      });

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      const [, ttl, value] = mockRedis.setex.mock.calls[0] as [
        string,
        number,
        string,
      ];
      expect(ttl).toBe(24 * 60 * 60);
      const parsed: CachedOcrResult = JSON.parse(value) as CachedOcrResult;
      expect(parsed.text).toBe('new text');
      expect(parsed.cachedAt).toBeDefined();
    });

    it('ควรไม่ throw เมื่อ redis.setex ล้มเหลว (cache write failure ไม่ block)', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.set('/tmp/test.pdf', 'np-dms-ocr', {
          text: 'text',
          engineUsed: 'np-dms-ocr',
          charCount: 4,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('ควรลบ cache entry สำเร็จ', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidate('/tmp/test.pdf', 'np-dms-ocr');

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      const key = (mockRedis.del.mock.calls[0] as unknown[])?.[0] as string;
      expect(key).toContain('ai:ocr:result:');
    });

    it('ควรไม่ throw เมื่อ redis.del ล้มเหลว', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidate('/tmp/test.pdf', 'np-dms-ocr')
      ).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('ควรคืน true เมื่อมี cache (count > 0)', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledTimes(1);
    });

    it('ควรคืน false เมื่อไม่มี cache (count = 0)', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBe(false);
    });
  });

  describe('get non-Error rejection', () => {
    it('ควรคืน null เมื่อ redis.get throw non-Error', async () => {
      mockRedis.get.mockRejectedValue('string-error');

      const result = await service.get('/tmp/test.pdf', 'np-dms-ocr');

      expect(result).toBeNull();
    });
  });

  describe('set non-Error rejection', () => {
    it('ควรไม่ throw เมื่อ redis.setex reject ด้วย non-Error', async () => {
      mockRedis.setex.mockRejectedValue('redis-down');

      await expect(
        service.set('/tmp/test.pdf', 'np-dms-ocr', {
          text: 'text',
          engineUsed: 'np-dms-ocr',
          charCount: 4,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('invalidate non-Error rejection', () => {
    it('ควรไม่ throw เมื่อ redis.del reject ด้วย non-Error', async () => {
      mockRedis.del.mockRejectedValue('del-error');

      await expect(
        service.invalidate('/tmp/test.pdf', 'np-dms-ocr')
      ).resolves.not.toThrow();
    });
  });

  describe('buildKey (via public methods)', () => {
    it('ควรสร้าง key ที่ deterministic สำหรับ input เดียวกัน', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0);

      await service.get('/tmp/doc.pdf', 'np-dms-ocr');
      await service.exists('/tmp/doc.pdf', 'np-dms-ocr');

      const getKey = (mockRedis.get.mock.calls[0] as unknown[])?.[0] as string;
      const existsKey = (
        mockRedis.exists.mock.calls[0] as unknown[]
      )?.[0] as string;
      expect(getKey).toBe(existsKey);
    });
  });
});
