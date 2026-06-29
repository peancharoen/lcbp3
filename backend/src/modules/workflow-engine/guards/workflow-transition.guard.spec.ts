// File: src/modules/workflow-engine/guards/workflow-transition.guard.spec.ts
// Unit tests for WorkflowTransitionGuard - T030

import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkflowTransitionGuard } from './workflow-transition.guard';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { UserService } from '../../../modules/user/user.service';
import type { RequestWithUser } from '../../../common/interfaces/request-with-user.interface';

type MockUserPayload = {
  user_id: number;
  email: string;
  primaryOrganizationId: number | null;
} | null;

describe('WorkflowTransitionGuard', () => {
  let guard: WorkflowTransitionGuard;
  let instanceRepo: { findOne: jest.Mock };
  let userService: { getUserPermissions: jest.Mock };
  let dataSource: { query: jest.Mock };

  const mockUser = {
    user_id: 123,
    email: 'test@example.com',
    primaryOrganizationId: 1,
  };

  const mockRequest = (
    params: Record<string, string> = {},
    user: MockUserPayload = mockUser,
    action = 'APPROVE'
  ): Partial<RequestWithUser> => ({
    params,
    body: { action },
    user: user as RequestWithUser['user'],
  });

  const mockContext = (req: Partial<RequestWithUser>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTransitionGuard,
        {
          provide: getRepositoryToken(WorkflowInstance),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserPermissions: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<WorkflowTransitionGuard>(WorkflowTransitionGuard);
    instanceRepo = module.get(getRepositoryToken(WorkflowInstance));
    userService = module.get(UserService);
    dataSource = module.get(DataSource);

    instanceRepo.findOne = jest.fn();
    userService.getUserPermissions = jest.fn();
    dataSource.query = jest.fn();
  });

  describe('Level 1: Superadmin', () => {
    it('should allow access for user with system.manage_all permission', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['system.manage_all']);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(userService.getUserPermissions).toHaveBeenCalledWith(123);
      expect(instanceRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('Level 2: Org Admin', () => {
    it('should allow access for org admin with same organization as document', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue([
        'organization.manage_users',
      ]);
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: 1 },
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(userService.getUserPermissions).toHaveBeenCalledWith(123);
      expect(instanceRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'instance-123' },
        relations: ['definition'],
      });
    });

    it('should deny access for org admin from different organization', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue([
        'organization.manage_users',
      ]);
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: 2 }, // Different org
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should deny access for org admin when document has no organization', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue([
        'organization.manage_users',
      ]);
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: undefined },
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('Level 2.5: Contract Membership', () => {
    it('should allow access for user in same contract as document AND assigned as handler', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']); // No special permissions
      const mockInstance = {
        id: 'instance-123',
        context: {
          organizationId: 2, // Different org from user
          assignedUserId: 123, // This user is assigned
        },
        contractId: 42, // Has contract
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      dataSource.query.mockResolvedValue([{ cnt: '1' }]); // User org in contract
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(dataSource.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) AS cnt FROM contract_organizations WHERE contract_id = ? AND organization_id = ?',
        [42, 1]
      );
    });

    it('should deny access for user not in contract (cross-contract block)', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: 1 },
        contractId: 42,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      dataSource.query.mockResolvedValue([{ cnt: '0' }]); // User org NOT in contract
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) AS cnt FROM contract_organizations WHERE contract_id = ? AND organization_id = ?',
        [42, 1]
      );
    });

    it('should deny access for user without primary organization when contract is present', async () => {
      // Arrange
      const userWithoutOrg = { ...mockUser, primaryOrganizationId: null };
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: 1 },
        contractId: 42,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(
        mockRequest({ id: 'instance-123' }, userWithoutOrg)
      );

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('Level 3: Assigned Handler', () => {
    it('should allow access for user assigned as handler', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const mockInstance = {
        id: 'instance-123',
        context: {
          organizationId: 2, // Different org
          assignedUserId: 123, // This user is assigned
        },
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access for different assigned user', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const mockInstance = {
        id: 'instance-123',
        context: {
          organizationId: 2,
          assignedUserId: 456, // Different user assigned
        },
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // T025: DSL require.role → CASL ability mapping tests
  describe('DSL CASL Role Mapping (FR-002a)', () => {
    it('should allow access when DSL requires OrgAdmin role and user has organization.manage_users', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'organization.manage_users',
      ]);
      const mockInstance = {
        id: 'instance-dsl-1',
        currentState: 'PENDING_REVIEW',
        context: { organizationId: 99 }, // Different org — Level 2 would deny
        contractId: null,
        definition: {
          compiled: {
            states: {
              PENDING_REVIEW: {
                transitions: {
                  APPROVE: { requirements: { roles: ['OrgAdmin'] } },
                },
              },
            },
          },
        },
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(
        mockRequest({ id: 'instance-dsl-1' }, mockUser, 'APPROVE')
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when DSL requires ContractMember and user has contract.view', async () => {
      userService.getUserPermissions.mockResolvedValue(['contract.view']);
      const mockInstance = {
        id: 'instance-dsl-2',
        currentState: 'REVIEW',
        context: { organizationId: 99 },
        contractId: null,
        definition: {
          compiled: {
            states: {
              REVIEW: {
                transitions: {
                  SUBMIT: { requirements: { roles: ['ContractMember'] } },
                },
              },
            },
          },
        },
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(
        mockRequest({ id: 'instance-dsl-2' }, mockUser, 'SUBMIT')
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny when DSL requires OrgAdmin but user only has contract.view', async () => {
      userService.getUserPermissions.mockResolvedValue(['contract.view']);
      const mockInstance = {
        id: 'instance-dsl-3',
        currentState: 'PENDING',
        context: { organizationId: 99 },
        contractId: null,
        definition: {
          compiled: {
            states: {
              PENDING: {
                transitions: {
                  APPROVE: { requirements: { roles: ['OrgAdmin'] } },
                },
              },
            },
          },
        },
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(
        mockRequest({ id: 'instance-dsl-3' }, mockUser, 'APPROVE')
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should fall through to Level 3 when DSL role is AssignedHandler', async () => {
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const mockInstance = {
        id: 'instance-dsl-4',
        currentState: 'ASSIGNED',
        context: { organizationId: 99, assignedUserId: 123 }, // same as mockUser.user_id
        contractId: null,
        definition: {
          compiled: {
            states: {
              ASSIGNED: {
                transitions: {
                  COMPLETE: {
                    requirements: { roles: ['AssignedHandler'] },
                  },
                },
              },
            },
          },
        },
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(
        mockRequest({ id: 'instance-dsl-4' }, mockUser, 'COMPLETE')
      );

      // AssignedHandler → falls to Level 3 check → passes because assignedUserId === user_id
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Level 4: Unauthorized Users', () => {
    it('should deny access for regular users without any special permissions', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']); // Basic permission only
      const mockInstance = {
        id: 'instance-123',
        context: { organizationId: 2 }, // Different org
        contractId: null,
      };
      instanceRepo.findOne.mockResolvedValue(mockInstance);
      const context = mockContext(mockRequest({ id: 'instance-123' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('Edge Cases', () => {
    it('should throw NotFoundException when workflow instance does not exist', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      instanceRepo.findOne.mockResolvedValue(null);
      const context = mockContext(mockRequest({ id: 'non-existent' }));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle missing user in request', async () => {
      // Arrange
      const context = mockContext(mockRequest({ id: 'instance-123' }, null));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow();
    });

    it('should handle missing instanceId in params', async () => {
      // Arrange
      userService.getUserPermissions.mockResolvedValue(['document.view']);
      const context = mockContext(mockRequest({})); // No id param

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });
});
