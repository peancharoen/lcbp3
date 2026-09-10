// File: backend/src/modules/ai/services/rag-generation-lock.service.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม unit tests สำหรับ Redlock acquire/release (Feature 254 coverage gap)

import { Test, TestingModule } from '@nestjs/testing';
import { RagGenerationLockService } from './rag-generation-lock.service';

/** Token ของ @nestjs-modules/ioredis — default Redis connection */
const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('RagGenerationLockService', () => {
  let service: RagGenerationLockService;
  const mockRedis = {
    set: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
    get: jest.fn(),
    exists: jest.fn(),
  };
  const mockLock = {
    release: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationLockService,
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<RagGenerationLockService>(RagGenerationLockService);
  });

  it('acquires a lock successfully for an attachment', async () => {
    const redlockSpy = jest
      .spyOn(
        (service as unknown as { redlock: { acquire: jest.Mock } }).redlock,
        'acquire'
      )
      .mockResolvedValue(mockLock as never);

    const lock = await service.acquire('att-019505a1');

    expect(redlockSpy).toHaveBeenCalledWith(
      ['lock:rag-attachment:att-019505a1'],
      expect.any(Number)
    );
    expect(lock).toBe(mockLock);
  });

  it('throws ServiceUnavailableException when lock acquisition fails', async () => {
    jest
      .spyOn(
        (service as unknown as { redlock: { acquire: jest.Mock } }).redlock,
        'acquire'
      )
      .mockRejectedValue(new Error('Lock contention') as never);

    await expect(service.acquire('att-busy')).rejects.toMatchObject({
      code: 'RAG_GENERATION_LOCK_UNAVAILABLE',
    });
  });

  it('uses the correct lock key format', async () => {
    const redlockSpy = jest
      .spyOn(
        (service as unknown as { redlock: { acquire: jest.Mock } }).redlock,
        'acquire'
      )
      .mockResolvedValue(mockLock as never);

    await service.acquire('att-unique-id');

    expect(redlockSpy).toHaveBeenCalledWith(
      ['lock:rag-attachment:att-unique-id'],
      expect.any(Number)
    );
  });
});
