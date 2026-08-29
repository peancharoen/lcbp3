// File: backend/src/modules/document-numbering/services/document-numbering-lock.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for DocumentNumberingLockService
// - 2026-06-13: Skipped lock service tests due to Redis dependency complexity
//   These tests require full IORedisModule setup which is out of scope for unit tests
// - 2026-08-28: Rewrote with full unit tests using mocked Redlock module

import { Test, TestingModule } from '@nestjs/testing';
import { DocumentNumberingLockService } from './document-numbering-lock.service';

// Mock Redlock module — the service creates `new Redlock([redis], ...)` in constructor
jest.mock('redlock', () => {
  const mockLock = {
    release: jest.fn().mockResolvedValue(undefined),
  };
  const MockRedlock = jest.fn().mockImplementation(() => ({
    acquire: jest.fn().mockResolvedValue(mockLock),
  }));
  return {
    __esModule: true,
    default: MockRedlock,
    Lock: class MockLock {},
  };
});

// นำเข้าหลัง jest.mock เพื่อให้ได้เวอร์ชันที่ถูก mock
import Redlock from 'redlock';

type MockRedlockInstance = {
  acquire: jest.Mock;
};

type MockLock = {
  release: jest.Mock;
};

describe('DocumentNumberingLockService', () => {
  let service: DocumentNumberingLockService;
  let mockRedis: Record<string, jest.Mock>;
  const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

  const mockKey = {
    projectId: 1,
    originatorOrgId: 2,
    recipientOrgId: 3,
    correspondenceTypeId: 4,
    subTypeId: 5,
    rfaTypeId: 6,
    disciplineId: 7,
    resetScope: 'YEAR_2025',
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentNumberingLockService,
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<DocumentNumberingLockService>(
      DocumentNumberingLockService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should construct Redlock with Redis client and config', () => {
    expect(Redlock).toHaveBeenCalledWith(
      [mockRedis],
      expect.objectContaining({
        driftFactor: 0.01,
        retryCount: 5,
        retryDelay: 100,
        retryJitter: 50,
      })
    );
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully and return the lock object', async () => {
      const lock = await service.acquireLock(mockKey);

      expect(lock).toBeDefined();
      expect(lock).toHaveProperty('release');
    });

    it('should call redlock.acquire with correct lock key and TTL', async () => {
      // ดึง instance ของ Redlock ที่ถูกสร้างใน constructor
      const redlockInstance = (Redlock as unknown as jest.Mock).mock.results[0]
        .value as MockRedlockInstance;

      await service.acquireLock(mockKey);

      const expectedKey = `lock:docnum:1:2:3:4:5:6:7:YEAR_2025`;
      expect(redlockInstance.acquire).toHaveBeenCalledWith([expectedKey], 5000);
    });

    it('should build lock key with 0 when recipientOrgId is 0', async () => {
      const redlockInstance = (Redlock as unknown as jest.Mock).mock.results[0]
        .value as MockRedlockInstance;

      const keyWithZeroRecipient = {
        ...mockKey,
        recipientOrgId: 0,
      };

      await service.acquireLock(keyWithZeroRecipient);

      const expectedKey = `lock:docnum:1:2:0:4:5:6:7:YEAR_2025`;
      expect(redlockInstance.acquire).toHaveBeenCalledWith([expectedKey], 5000);
    });

    it('should build lock key with 0 when recipientOrgId is null (?? fallback)', async () => {
      const redlockInstance = (Redlock as unknown as jest.Mock).mock.results[0]
        .value as MockRedlockInstance;

      const keyWithNullRecipient = {
        ...mockKey,
        recipientOrgId: null as unknown as number,
      };

      await service.acquireLock(keyWithNullRecipient);

      const expectedKey = `lock:docnum:1:2:0:4:5:6:7:YEAR_2025`;
      expect(redlockInstance.acquire).toHaveBeenCalledWith([expectedKey], 5000);
    });

    it('should rethrow error when redlock.acquire fails', async () => {
      const redlockInstance = (Redlock as unknown as jest.Mock).mock.results[0]
        .value as MockRedlockInstance;
      const acquireError = new Error('Lock acquisition failed');
      redlockInstance.acquire.mockRejectedValueOnce(acquireError);

      await expect(service.acquireLock(mockKey)).rejects.toThrow(
        'Lock acquisition failed'
      );
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      const lock = await service.acquireLock(mockKey);

      await expect(service.releaseLock(lock)).resolves.not.toThrow();
    });

    it('should call lock.release', async () => {
      const lock = (await service.acquireLock(mockKey)) as unknown as MockLock;

      await service.releaseLock(lock);

      expect(lock.release).toHaveBeenCalled();
    });

    it('should not throw when lock.release fails (expired lock)', async () => {
      const lock = (await service.acquireLock(mockKey)) as unknown as MockLock;
      lock.release.mockRejectedValueOnce(new Error('Lock expired'));

      await expect(service.releaseLock(lock)).resolves.not.toThrow();
    });
  });
});
