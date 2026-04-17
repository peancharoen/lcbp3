import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditMetadata } from '../decorators/audit.decorator';
import { User } from '../../modules/user/entities/user.entity';
import { of, lastValueFrom } from 'rxjs';
import { Request } from 'express';
import type { Socket } from 'net';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;
  let auditLogRepo: jest.Mocked<Partial<typeof AuditLog.prototype.constructor>>;

  const createMockUser = (userId: number): User => {
    const user = new User();
    user.user_id = userId;
    user.username = 'testuser';
    user.email = 'test@example.com';
    return user;
  };

  const createMockRequest = (
    user?: User,
    params: Record<string, string> = {},
    ip: string = '127.0.0.1',
    userAgent: string = 'test-agent'
  ): Partial<Request> => ({
    user,
    params,
    ip,
    socket: { remoteAddress: ip } as unknown as Socket,
    get: jest.fn().mockReturnValue(userAgent),
  });

  const createMockExecutionContext = (
    auditMetadata: AuditMetadata | undefined,
    user?: User,
    params: Record<string, string> = {}
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => createMockRequest(user, params),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  const createMockCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
    reflector = module.get<Reflector>(Reflector);
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ==========================================================
  // No audit metadata
  // ==========================================================
  describe('when no audit metadata', () => {
    it('should pass through without creating audit log', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext(undefined, undefined);
      const callHandler = createMockCallHandler({ id: 'test-uuid' });

      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );

      expect(result).toEqual({ id: 'test-uuid' });
      expect(auditLogRepo.create).not.toHaveBeenCalled();
      expect(auditLogRepo.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================================
  // Audit log creation
  // ==========================================================
  describe('audit log creation', () => {
    it('should create audit log with basic metadata', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'correspondence.create',
        entityType: 'correspondence',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({ id: 'new-uuid' });

      await lastValueFrom(interceptor.intercept(context, callHandler));

      // Wait for async tap operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: 'correspondence.create',
          entityType: 'correspondence',
          severity: 'INFO',
        })
      );
      expect(auditLogRepo.save).toHaveBeenCalled();
    });

    it('should extract entityId from response data.id', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'correspondence.update',
        entityType: 'correspondence',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({ id: 'entity-uuid-123' });

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-uuid-123',
        })
      );
    });

    it('should extract entityId from response audit_id', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'audit.view',
        entityType: 'audit_log',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({ audit_id: 'audit-123' });

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'audit-123',
        })
      );
    });

    it('should extract entityId from response user_id', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'user.update',
        entityType: 'user',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({ user_id: '42' });

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '42',
        })
      );
    });

    it('should extract entityId from request params if not in data', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'correspondence.delete',
        entityType: 'correspondence',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user, {
        id: 'param-uuid-456',
      });
      const callHandler = createMockCallHandler({ success: true });

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'param-uuid-456',
        })
      );
    });
  });

  // ==========================================================
  // User handling
  // ==========================================================
  describe('user handling', () => {
    it('should handle authenticated user', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(42);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
        })
      );
    });

    it('should handle unauthenticated request (no user)', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'public.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const context = createMockExecutionContext(auditMetadata, undefined);
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      );
    });
  });

  // ==========================================================
  // Request metadata extraction
  // ==========================================================
  describe('request metadata extraction', () => {
    it('should capture IP address from request', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = {
        switchToHttp: () => ({
          getRequest: () =>
            createMockRequest(user, {}, '192.168.1.100', 'test-agent'),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        })
      );
    });

    it('should capture user agent from request', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = {
        switchToHttp: () => ({
          getRequest: () =>
            createMockRequest(
              user,
              {},
              '127.0.0.1',
              'Mozilla/5.0 Test Browser'
            ),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 Test Browser',
        })
      );
    });

    it('should use socket.remoteAddress as IP fallback', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            params: {},
            ip: undefined,
            socket: { remoteAddress: '10.0.0.1' },
            get: jest.fn().mockReturnValue(''),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '10.0.0.1',
        })
      );
    });
  });

  // ==========================================================
  // Error handling
  // ==========================================================
  describe('error handling', () => {
    it('should log error when audit log save fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);
      jest.spyOn(auditLogRepo, 'save').mockRejectedValue(new Error('DB Error'));

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create audit log for test.action')
      );
    });

    it('should not throw when audit log save fails', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);
      jest.spyOn(auditLogRepo, 'save').mockRejectedValue(new Error('DB Error'));

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler({ id: 'test' });

      // Should not throw
      const result = await lastValueFrom(
        interceptor.intercept(context, callHandler)
      );
      expect(result).toEqual({ id: 'test' });
    });
  });

  // ==========================================================
  // Edge cases
  // ==========================================================
  describe('edge cases', () => {
    it('should handle null response data', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler(null);

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalled();
    });

    it('should handle non-object response data', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = createMockExecutionContext(auditMetadata, user);
      const callHandler = createMockCallHandler('string response');

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: undefined,
        })
      );
    });

    it('should handle array IP address', async () => {
      const auditMetadata: AuditMetadata = {
        action: 'test.action',
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(auditMetadata);

      const user = createMockUser(1);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            params: {},
            ip: ['192.168.1.1', '10.0.0.1'],
            socket: {},
            get: jest.fn().mockReturnValue(''),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;
      const callHandler = createMockCallHandler({});

      await lastValueFrom(interceptor.intercept(context, callHandler));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1', // First element of array
        })
      );
    });
  });
});
