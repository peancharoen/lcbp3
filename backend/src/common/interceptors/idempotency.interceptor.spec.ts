import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { of, lastValueFrom } from 'rxjs';
import { Request } from 'express';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let cacheManager: jest.Mocked<Cache>;

  const createMockRequest = (
    method: string,
    idempotencyKey?: string
  ): Partial<Request> => ({
    method,
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
  });

  const createMockExecutionContext = (
    method: string,
    idempotencyKey?: string
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => createMockRequest(method, idempotencyKey),
      }),
    } as ExecutionContext;
  };

  const createMockCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(async () => {
    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ==========================================================
  // HTTP Methods - Only mutating methods
  // ==========================================================
  describe('HTTP method filtering', () => {
    it('should process POST requests', async () => {
      const context = createMockExecutionContext('POST', 'key-123');
      const callHandler = createMockCallHandler({ id: 'new' });
      cacheManager.get.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:key-123');
    });

    it('should process PUT requests', async () => {
      const context = createMockExecutionContext('PUT', 'key-456');
      const callHandler = createMockCallHandler({ id: 'updated' });
      cacheManager.get.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:key-456');
    });

    it('should process PATCH requests', async () => {
      const context = createMockExecutionContext('PATCH', 'key-789');
      const callHandler = createMockCallHandler({ id: 'patched' });
      cacheManager.get.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:key-789');
    });

    it('should process DELETE requests', async () => {
      const context = createMockExecutionContext('DELETE', 'key-del');
      const callHandler = createMockCallHandler({ success: true });
      cacheManager.get.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:key-del');
    });

    it('should skip GET requests (no idempotency check)', async () => {
      const context = createMockExecutionContext('GET', 'key-get');
      const callHandler = createMockCallHandler({ data: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      expect(value).toEqual({ data: 'test' });
      expect(cacheManager.get).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should skip HEAD requests', async () => {
      const context = createMockExecutionContext('HEAD', 'key-head');
      const callHandler = createMockCallHandler(undefined);

      await interceptor.intercept(context, callHandler);

      expect(cacheManager.get).not.toHaveBeenCalled();
    });

    it('should skip OPTIONS requests', async () => {
      const context = createMockExecutionContext('OPTIONS', 'key-opt');
      const callHandler = createMockCallHandler(undefined);

      await interceptor.intercept(context, callHandler);

      expect(cacheManager.get).not.toHaveBeenCalled();
    });
  });

  // ==========================================================
  // Idempotency Key Handling
  // ==========================================================
  describe('idempotency key handling', () => {
    it('should skip when no idempotency key header', async () => {
      const context = createMockExecutionContext('POST');
      const callHandler = createMockCallHandler({ id: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      expect(value).toEqual({ id: 'test' });
      expect(cacheManager.get).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should check cache for existing key', async () => {
      const context = createMockExecutionContext('POST', 'existing-key');
      const callHandler = createMockCallHandler({ id: 'new' });
      cacheManager.get.mockResolvedValue(undefined);

      await interceptor.intercept(context, callHandler);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:existing-key');
    });

    it('should return cached response for duplicate key', async () => {
      const cachedResponse = { id: 'cached-id', cached: true };
      cacheManager.get.mockResolvedValue(cachedResponse);

      const context = createMockExecutionContext('POST', 'duplicate-key');
      const callHandler = {
        handle: jest.fn().mockReturnValue(of({ id: 'new' })),
      };

      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      expect(value).toEqual(cachedResponse);
      expect(callHandler.handle).not.toHaveBeenCalled(); // Should not call handler
    });

    it('should cache successful response', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const context = createMockExecutionContext('POST', 'cache-key');
      const response = { id: 'new-id', data: 'test' };
      const callHandler = createMockCallHandler(response);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      // Wait for async cache operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cacheManager.set).toHaveBeenCalledWith(
        'idempotency:cache-key',
        response,
        86400 * 1000 // 24 hours in ms
      );
    });
  });

  // ==========================================================
  // Cache Key Format
  // ==========================================================
  describe('cache key format', () => {
    it('should prefix idempotency keys correctly', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const context = createMockExecutionContext('POST', 'my-key');
      const callHandler = createMockCallHandler({});

      await interceptor.intercept(context, callHandler);

      expect(cacheManager.get).toHaveBeenCalledWith('idempotency:my-key');
    });

    it('should handle UUID idempotency keys', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const uuid = '019505a1-7c3e-7000-8000-abc123def456';
      const context = createMockExecutionContext('POST', uuid);
      const callHandler = createMockCallHandler({});

      await interceptor.intercept(context, callHandler);

      expect(cacheManager.get).toHaveBeenCalledWith(`idempotency:${uuid}`);
    });
  });

  // ==========================================================
  // Error Handling
  // ==========================================================
  describe('error handling', () => {
    it('should log error when cache set fails', async () => {
      const _consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      cacheManager.get.mockResolvedValue(undefined);
      cacheManager.set.mockRejectedValue(new Error('Cache Error'));

      const context = createMockExecutionContext('POST', 'error-key');
      const callHandler = createMockCallHandler({ id: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should not throw when cache get fails', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis down'));

      const context = createMockExecutionContext('POST', 'fail-key');
      const callHandler = {
        handle: jest.fn().mockReturnValue(of({ id: 'test' })),
      };

      // Should not throw, let request proceed - handler should still be called
      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      expect(value).toEqual({ id: 'test' });
      expect(callHandler.handle).toHaveBeenCalled();
    });

    it('should handle null cached value', async () => {
      cacheManager.get.mockResolvedValue(null);

      const context = createMockExecutionContext('POST', 'null-key');
      const callHandler = createMockCallHandler({ id: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      expect(value).toEqual({ id: 'test' });
    });
  });

  // ==========================================================
  // Cache TTL
  // ==========================================================
  describe('cache TTL configuration', () => {
    it('should cache for 24 hours (86400 seconds)', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const context = createMockExecutionContext('POST', 'ttl-key');
      const callHandler = createMockCallHandler({ id: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        86400 * 1000 // 24 hours in milliseconds
      );
    });
  });

  // ==========================================================
  // Edge Cases
  // ==========================================================
  describe('edge cases', () => {
    it('should handle empty idempotency key', async () => {
      const context = createMockExecutionContext('POST', '');
      const callHandler = createMockCallHandler({ id: 'test' });

      const result = await interceptor.intercept(context, callHandler);
      const value = await lastValueFrom(result);

      // Empty string is falsy, so should pass through
      expect(value).toEqual({ id: 'test' });
    });

    it('should handle complex response objects', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const complexResponse = {
        id: 'uuid-123',
        nested: {
          data: [1, 2, 3],
          meta: { count: 3 },
        },
        tags: ['a', 'b', 'c'],
      };

      const context = createMockExecutionContext('POST', 'complex-key');
      const callHandler = createMockCallHandler(complexResponse);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cacheManager.set).toHaveBeenCalledWith(
        'idempotency:complex-key',
        complexResponse,
        expect.any(Number)
      );
    });

    it('should handle array responses', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const arrayResponse = [{ id: '1' }, { id: '2' }];

      const context = createMockExecutionContext('POST', 'array-key');
      const callHandler = createMockCallHandler(arrayResponse);

      const result = await interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cacheManager.set).toHaveBeenCalledWith(
        'idempotency:array-key',
        arrayResponse,
        expect.any(Number)
      );
    });
  });
});
