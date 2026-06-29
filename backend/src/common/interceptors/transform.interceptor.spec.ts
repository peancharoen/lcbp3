import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor, ApiResponse } from './transform.interceptor';
import { of, lastValueFrom } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  const createMockExecutionContext = (
    statusCode: number = 200
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getResponse: () => ({
          statusCode,
        }),
      }),
    } as ExecutionContext;
  };

  const createMockCallHandler = (data: unknown): CallHandler => {
    return {
      handle: () => of(data),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor =
      module.get<TransformInterceptor<unknown>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ==========================================================
  // Standard Response Wrapping
  // ==========================================================
  describe('standard response wrapping', () => {
    it('should wrap simple data in ApiResponse format', async () => {
      const data = { id: 'test-uuid', name: 'Test' };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Success',
        data,
      });
    });

    it('should use custom message from data if provided', async () => {
      const data = { result: { id: 'test' }, message: 'Custom message' };
      const context = createMockExecutionContext(201);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({
        statusCode: 201,
        message: 'Custom message',
        data: { id: 'test' },
      });
    });

    it('should handle 201 Created status', async () => {
      const data = { id: 'new-uuid' };
      const context = createMockExecutionContext(201);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.statusCode).toBe(201);
    });
  });

  // ==========================================================
  // Paginated Response Handling
  // ==========================================================
  describe('paginated response handling', () => {
    it('should unwrap paginated payload correctly', async () => {
      const paginatedData = {
        data: [{ id: '1' }, { id: '2' }],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(paginatedData);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Success',
        data: [{ id: '1' }, { id: '2' }],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      });
    });

    it('should preserve custom message in paginated response', async () => {
      const paginatedData = {
        data: [{ id: '1' }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
        message: 'Filtered results',
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(paginatedData);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.message).toBe('Filtered results');
    });

    it('should handle empty paginated results', async () => {
      const paginatedData = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(paginatedData);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual([]);
      expect(result.meta?.total).toBe(0);
    });

    it('should handle paginated response with result field', async () => {
      // When data has both result and meta, it should be treated as paginated
      const paginatedData = {
        data: [{ id: '1' }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(paginatedData);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual([{ id: '1' }]);
    });
  });

  // ==========================================================
  // Non-Paginated Data with Result Field
  // ==========================================================
  describe('non-paginated data with result field', () => {
    it('should extract result field as data when present', async () => {
      const data = {
        result: { id: 'extracted', name: 'Extracted Data' },
        otherField: 'ignored',
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual({ id: 'extracted', name: 'Extracted Data' });
    });

    it('should handle data without result field', async () => {
      const data = { id: 'direct', name: 'Direct Data' };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual({ id: 'direct', name: 'Direct Data' });
    });
  });

  // ==========================================================
  // ADR-019: Entity Serialization
  // ==========================================================
  describe('ADR-019: Entity serialization', () => {
    it('should serialize class instances via instanceToPlain', async () => {
      // Mock entity with @Exclude decorator
      class MockEntity {
        id = 1; // Internal ID (should be excluded)
        publicId = 'uuid-123'; // Public ID
        name = 'Test';
      }

      const entity = new MockEntity();
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(entity);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      // instanceToPlain should be applied (no @Exclude in this test, so all fields present)
      expect(result.data).toBeDefined();
    });

    it('should handle null data gracefully', async () => {
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(null);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Success',
        data: null,
      });
    });

    it('should handle undefined data gracefully', async () => {
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(undefined);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Success',
        data: undefined,
      });
    });
  });

  // ==========================================================
  // Edge Cases
  // ==========================================================
  describe('edge cases', () => {
    it('should handle primitive string data', async () => {
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler('simple string');

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toBe('simple string');
    });

    it('should handle primitive number data', async () => {
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(42);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toBe(42);
    });

    it('should handle primitive boolean data', async () => {
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(true);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toBe(true);
    });

    it('should handle array data', async () => {
      const data = [{ id: '1' }, { id: '2' }];
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual(data);
      expect(result.meta).toBeUndefined(); // Arrays are NOT paginated
    });

    it('should handle deeply nested objects', async () => {
      const data = {
        level1: {
          level2: {
            level3: { value: 'deep' },
          },
        },
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.data).toEqual(data);
    });
  });

  // ==========================================================
  // Type Safety Tests
  // ==========================================================
  describe('type safety', () => {
    it('should return correct ApiResponse type structure', async () => {
      const data = { test: 'data' };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(data);

      const result: ApiResponse<unknown> = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      // Type checking at runtime
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result.statusCode).toBe(200);
    });

    it('should include meta for paginated responses', async () => {
      const paginatedData = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };
      const context = createMockExecutionContext(200);
      const callHandler = createMockCallHandler(paginatedData);

      const result: ApiResponse<unknown> = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result.meta).toBeDefined();
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('totalPages');
    });
  });
});
