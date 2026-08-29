// File: src/modules/user/user-assignment.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ UserAssignmentService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserAssignmentService } from './user-assignment.service';
import { UserAssignment } from './entities/user-assignment.entity';
import { User } from './entities/user.entity';
import { AssignRoleDto } from './dto/assign-role.dto';
import { BulkAssignmentDto, ActionType } from './dto/bulk-assignment.dto';
import { ValidationException } from '../../common/exceptions';

describe('UserAssignmentService', () => {
  let service: UserAssignmentService;

  const mockAssignmentRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockManager = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockManager,
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockAssigner: Partial<User> = { user_id: 99 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAssignmentService,
        {
          provide: getRepositoryToken(UserAssignment),
          useValue: mockAssignmentRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserAssignmentService>(UserAssignmentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRole', () => {
    it('ควรสร้าง assignment สำหรับ organization scope', async () => {
      const dto: AssignRoleDto = {
        userId: 1,
        roleId: 2,
        organizationId: 10,
      };
      const created: Partial<UserAssignment> = {
        userId: 1,
        roleId: 2,
        organizationId: 10,
        assignedByUserId: 99,
      };
      mockAssignmentRepo.create.mockReturnValue(created);
      mockAssignmentRepo.save.mockResolvedValue(created);

      const result = await service.assignRole(dto, mockAssigner as User);

      expect(mockAssignmentRepo.create).toHaveBeenCalledWith({
        userId: 1,
        roleId: 2,
        organizationId: 10,
        projectId: undefined,
        contractId: undefined,
        assignedByUserId: 99,
      });
      expect(result).toEqual(created);
    });

    it('ควรสร้าง assignment สำหรับ project scope', async () => {
      const dto: AssignRoleDto = {
        userId: 1,
        roleId: 2,
        projectId: 20,
      };
      const created: Partial<UserAssignment> = {
        userId: 1,
        roleId: 2,
        projectId: 20,
        assignedByUserId: 99,
      };
      mockAssignmentRepo.create.mockReturnValue(created);
      mockAssignmentRepo.save.mockResolvedValue(created);

      const result = await service.assignRole(dto, mockAssigner as User);

      expect(result).toEqual(created);
    });

    it('ควรสร้าง assignment สำหรับ contract scope', async () => {
      const dto: AssignRoleDto = {
        userId: 1,
        roleId: 2,
        contractId: 30,
      };
      const created: Partial<UserAssignment> = {
        userId: 1,
        roleId: 2,
        contractId: 30,
        assignedByUserId: 99,
      };
      mockAssignmentRepo.create.mockReturnValue(created);
      mockAssignmentRepo.save.mockResolvedValue(created);

      const result = await service.assignRole(dto, mockAssigner as User);

      expect(result).toEqual(created);
    });

    it('ควร throw ValidationException เมื่อเลือกหลาย scope', async () => {
      const dto: AssignRoleDto = {
        userId: 1,
        roleId: 2,
        organizationId: 10,
        projectId: 20,
      };

      await expect(
        service.assignRole(dto, mockAssigner as User)
      ).rejects.toThrow(ValidationException);
      expect(mockAssignmentRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdateAssignments', () => {
    it('ควร add assignments ใน transaction', async () => {
      const dto: BulkAssignmentDto = {
        assignments: [
          {
            userId: 1,
            roleId: 2,
            action: ActionType.ADD,
            organizationId: 10,
          },
        ],
      };
      const created: Partial<UserAssignment> = {
        userId: 1,
        roleId: 2,
        organizationId: 10,
        assignedByUserId: 99,
      };
      mockManager.create.mockReturnValue(created);
      mockManager.save.mockResolvedValue(created);

      const result = await service.bulkUpdateAssignments(
        dto,
        mockAssigner as User
      );

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(created);
    });

    it('ควร remove assignments ใน transaction', async () => {
      const dto: BulkAssignmentDto = {
        assignments: [
          {
            userId: 1,
            roleId: 2,
            action: ActionType.REMOVE,
            organizationId: 10,
          },
        ],
      };
      mockManager.delete.mockResolvedValue(undefined);

      const result = await service.bulkUpdateAssignments(
        dto,
        mockAssigner as User
      );

      expect(mockManager.delete).toHaveBeenCalledWith(UserAssignment, {
        userId: 1,
        roleId: 2,
        organizationId: 10,
      });
      expect(result[0]).toEqual({
        userId: 1,
        roleId: 2,
        organizationId: 10,
        status: 'removed',
      });
    });

    it('ควร throw ValidationException เมื่อ add หลาย scope', async () => {
      const dto: BulkAssignmentDto = {
        assignments: [
          {
            userId: 1,
            roleId: 2,
            action: ActionType.ADD,
            organizationId: 10,
            projectId: 20,
          },
        ],
      };

      await expect(
        service.bulkUpdateAssignments(dto, mockAssigner as User)
      ).rejects.toThrow(ValidationException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อเกิด error', async () => {
      const dto: BulkAssignmentDto = {
        assignments: [
          {
            userId: 1,
            roleId: 2,
            action: ActionType.ADD,
            organizationId: 10,
          },
        ],
      };
      const error = new Error('DB error');
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(error);

      await expect(
        service.bulkUpdateAssignments(dto, mockAssigner as User)
      ).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
