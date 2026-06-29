import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { UserService } from '../../modules/user/user.service';
import { User } from '../../modules/user/entities/user.entity';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;
  let userService: UserService;

  const createMockExecutionContext = (
    user?: User,
    _handlerPermissions?: string[]
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  const createMockUser = (userId: number): User => {
    const user = new User();
    user.user_id = userId;
    user.username = 'testuser';
    user.email = 'test@example.com';
    return user;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RbacGuard>(RbacGuard);
    reflector = module.get<Reflector>(Reflector);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  // ==========================================================
  // No permissions required
  // ==========================================================
  describe('when no permissions required', () => {
    it('should allow access when no permissions decorator', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when empty permissions array', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // ==========================================================
  // User not in request
  // ==========================================================
  describe('when user not in request', () => {
    it('should throw ForbiddenException when user is undefined', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read']);
      const context = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found in request'
      );
    });
  });

  // ==========================================================
  // Single permission checks
  // ==========================================================
  describe('single permission checks', () => {
    it('should allow when user has exact permission', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read', 'correspondence.create']);

      const context = createMockExecutionContext(createMockUser(1));
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny when user lacks required permission', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.delete']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read', 'correspondence.create']);

      const context = createMockExecutionContext(createMockUser(1));

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'You do not have permission: correspondence.delete'
      );
    });
  });

  // ==========================================================
  // Multiple permissions checks (ALL required)
  // ==========================================================
  describe('multiple permissions checks (ALL required)', () => {
    it('should allow when user has ALL required permissions', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read', 'correspondence.create']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue([
          'correspondence.read',
          'correspondence.create',
          'correspondence.update',
        ]);

      const context = createMockExecutionContext(createMockUser(1));
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny when user has only SOME required permissions', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read', 'correspondence.create']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read']); // Missing create

      const context = createMockExecutionContext(createMockUser(1));

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should deny when user has none of the required permissions', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read', 'correspondence.create']);
      jest.spyOn(userService, 'getUserPermissions').mockResolvedValue([]);

      const context = createMockExecutionContext(createMockUser(1));

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ==========================================================
  // Superadmin bypass (system.manage_all)
  // ==========================================================
  describe('superadmin bypass (system.manage_all)', () => {
    it('should allow superadmin to access any permission', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.delete', 'user.manage']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['system.manage_all']); // Only superadmin permission

      const context = createMockExecutionContext(createMockUser(1));
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow superadmin with other permissions', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['rfa.approve']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue([
          'correspondence.read',
          'system.manage_all',
          'project.view',
        ]);

      const context = createMockExecutionContext(createMockUser(1));
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should still check permissions for non-superadmin', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['admin.only.permission']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read', 'correspondence.create']);

      const context = createMockExecutionContext(createMockUser(1));

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ==========================================================
  // Permission service integration
  // ==========================================================
  describe('permission service integration', () => {
    it('should call getUserPermissions with correct user_id', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read']);
      const getPermissionsSpy = jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read']);

      const mockUser = createMockUser(42);
      const context = createMockExecutionContext(mockUser);

      await guard.canActivate(context);

      expect(getPermissionsSpy).toHaveBeenCalledWith(42);
    });

    it('should call getUserPermissions only once per request', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read']);
      const getPermissionsSpy = jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read']);

      const context = createMockExecutionContext(createMockUser(1));

      await guard.canActivate(context);

      expect(getPermissionsSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================
  // Reflector metadata priority
  // ==========================================================
  describe('reflector metadata priority', () => {
    it('should check handler and class metadata', async () => {
      const getAllAndOverrideSpy = jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['correspondence.read']);
      jest
        .spyOn(userService, 'getUserPermissions')
        .mockResolvedValue(['correspondence.read']);

      const context = createMockExecutionContext(createMockUser(1));
      await guard.canActivate(context);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
