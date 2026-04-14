import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { PerformanceInterceptor } from './performance.interceptor';
import { MetricsService } from '../../modules/monitoring/services/metrics.service';
import { of, throwError, lastValueFrom } from 'rxjs';
import { delay } from 'rxjs/operators';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let metricsService: jest.Mocked<MetricsService>;

  const createMockRequest = (url: string, method: string) => ({
    url,
    method,
    route: url.startsWith('/api/')
      ? { path: url.replace('/api', '') }
      : undefined,
  });

  const createMockResponse = (statusCode: number) => ({
    statusCode,
  });

  const createMockExecutionContext = (
    url: string,
    method: string,
    statusCode: number
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => createMockRequest(url, method),
        getResponse: () => createMockResponse(statusCode),
      }),
    } as ExecutionContext;
  };

  const createMockCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(async () => {
    const mockMetrics = {
      httpRequestsTotal: {
        inc: jest.fn(),
      },
      httpRequestDuration: {
        observe: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceInterceptor,
        {
          provide: MetricsService,
          useValue: mockMetrics,
        },
      ],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);
    metricsService = module.get(MetricsService);

    // Mock Logger to suppress output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Re-initialize metricsService mocks after clearing
    metricsService.httpRequestsTotal.inc = jest.fn();
    metricsService.httpRequestDuration.observe = jest.fn();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ==========================================================
  // Metrics endpoint exclusion
  // ==========================================================
  describe('endpoint exclusions', () => {
    it('should skip /metrics endpoint', () => {
      const context = createMockExecutionContext('/metrics', 'GET', 200);
      const callHandler = createMockCallHandler({});
      const handleSpy = jest.spyOn(callHandler, 'handle');

      interceptor.intercept(context, callHandler);

      expect(handleSpy).toHaveBeenCalled();
      expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();
    });

    it('should skip /health endpoint', () => {
      const context = createMockExecutionContext('/health', 'GET', 200);
      const callHandler = createMockCallHandler({ status: 'ok' });

      interceptor.intercept(context, callHandler);

      expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();
    });

    it('should process regular API endpoints', async () => {
      const context = createMockExecutionContext(
        '/api/correspondences',
        'GET',
        200
      );
      const callHandler = createMockCallHandler({ data: [] });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // Metrics recording
  // ==========================================================
  describe('metrics recording', () => {
    it('should increment request counter with correct labels', async () => {
      const context = createMockExecutionContext(
        '/api/correspondences',
        'GET',
        200
      );
      const callHandler = createMockCallHandler({ data: [] });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/correspondences',
        status_code: '200',
      });
    });

    it('should observe request duration with correct labels', async () => {
      const context = createMockExecutionContext(
        '/api/correspondences',
        'POST',
        201
      );
      const callHandler = createMockCallHandler({ id: 'new-uuid' });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
        {
          method: 'POST',
          route: '/correspondences',
          status_code: '201',
        },
        expect.any(Number) // Duration in seconds
      );
    });

    it('should use route path when available', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/correspondences/123e4567-e89b-12d3-a456-426614174000',
            method: 'GET',
            route: { path: '/api/correspondences/:uuid' },
          }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/api/correspondences/:uuid',
        })
      );
    });

    it('should fallback to URL when route not available', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/special-endpoint',
            method: 'GET',
            // No route property
          }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/api/special-endpoint',
        })
      );
    });
  });

  // ==========================================================
  // Error handling
  // ==========================================================
  describe('error handling', () => {
    it('should record metrics for error responses', async () => {
      const context = createMockExecutionContext(
        '/api/correspondences',
        'POST',
        500
      );
      const callHandler: CallHandler = {
        handle: () => throwError(() => ({ status: 500, message: 'Error' })),
      };

      const result = interceptor.intercept(context, callHandler);

      try {
        await lastValueFrom(result);
      } catch {
        // Expected error
      }

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'POST',
        route: '/correspondences',
        status_code: '500',
      });
    });

    it('should use error status code when available', async () => {
      const context = createMockExecutionContext('/api/test', 'GET', 400);
      const callHandler: CallHandler = {
        handle: () => throwError(() => ({ status: 400 })),
      };

      const result = interceptor.intercept(context, callHandler);

      try {
        await lastValueFrom(result);
      } catch {
        // Expected
      }

      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should default to 500 for errors without status', async () => {
      const context = createMockExecutionContext('/api/test', 'GET', 500);
      const callHandler: CallHandler = {
        handle: () => throwError(() => new Error('Unknown error')),
      };

      const result = interceptor.intercept(context, callHandler);

      try {
        await lastValueFrom(result);
      } catch {
        // Expected
      }

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: '500',
        })
      );
    });
  });

  // ==========================================================
  // Logging behavior
  // ==========================================================
  describe('logging behavior', () => {
    it('should log slow requests (>200ms)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/slow-endpoint',
            method: 'GET',
            route: { path: '/api/slow-endpoint' },
          }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as ExecutionContext;

      const callHandler: CallHandler = {
        handle: () =>
          of({}).pipe(
            delay(250) // Simulate slow response >200ms
          ),
      };

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log error responses (>=400)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const context = createMockExecutionContext('/api/error', 'GET', 400);
      const callHandler = createMockCallHandler({ error: 'Bad Request' });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          level: 'warn',
        })
      );
    });

    it('should log server errors with error level (>=500)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const context = createMockExecutionContext('/api/error', 'GET', 500);
      const callHandler = createMockCallHandler({ error: 'Server Error' });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          level: 'error',
        })
      );
    });

    it('should NOT log fast successful requests', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const context = createMockExecutionContext('/api/fast', 'GET', 200);
      const callHandler = createMockCallHandler({ data: 'quick' });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      // Fast requests (<200ms, status <400) should not be logged
      const slowOrErrorLogs = logSpy.mock.calls.filter(
        (call) =>
          (call[0] as { durationMs?: number })?.durationMs !== undefined ||
          ((call[0] as { statusCode?: number })?.statusCode ?? 0) >= 400
      );
      expect(slowOrErrorLogs.length).toBe(0);
    });
  });

  // ==========================================================
  // Duration calculation
  // ==========================================================
  describe('duration calculation', () => {
    it('should calculate duration in seconds', async () => {
      const context = createMockExecutionContext('/api/test', 'GET', 200);
      const callHandler = createMockCallHandler({});

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      const observeCall = (
        metricsService.httpRequestDuration.observe as jest.Mock
      ).mock.calls[0] as unknown[];
      const durationSeconds = observeCall[1] as number;

      expect(durationSeconds).toBeGreaterThanOrEqual(0);
      expect(durationSeconds).toBeLessThan(1); // Should be very fast in tests
    });

    it('should log duration in milliseconds', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const context = createMockExecutionContext('/api/slow', 'GET', 200);

      const callHandler: CallHandler = {
        handle: () => of({}).pipe(delay(250)), // Slow response
      };

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      const logCall = logSpy.mock.calls.find(
        (call) => (call[0] as { durationMs?: number })?.durationMs !== undefined
      );

      expect(logCall).toBeDefined();
      if (logCall) {
        expect(
          (logCall[0] as { durationMs: number }).durationMs
        ).toBeGreaterThanOrEqual(200);
      }
    });
  });

  // ==========================================================
  // Edge cases
  // ==========================================================
  describe('edge cases', () => {
    it('should handle empty URL', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '',
            method: 'GET',
          }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '',
        })
      );
    });

    it('should handle various HTTP methods', async () => {
      const methods = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD',
        'OPTIONS',
      ];

      for (const method of methods) {
        jest.clearAllMocks();
        // Re-initialize metricsService mocks after clearing
        metricsService.httpRequestsTotal.inc = jest.fn();
        metricsService.httpRequestDuration.observe = jest.fn();

        const context = createMockExecutionContext('/api/test', method, 200);
        const callHandler = createMockCallHandler({});

        const result = interceptor.intercept(context, callHandler);
        await lastValueFrom(result);

        expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
          expect.objectContaining({
            method,
          })
        );
      }
    });

    it('should handle response with final status code', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/test',
            method: 'POST',
            route: { path: '/api/test' },
          }),
          getResponse: () => ({ statusCode: 201 }), // Different from initial
        }),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({ id: 'new' });

      const result = interceptor.intercept(context, callHandler);
      await lastValueFrom(result);

      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: '201',
        })
      );
    });
  });
});
