// File: backend/src/modules/user/user.service.spec.ts
// Change Log:
// - 2026-09-15: Extended with create, findOne, findOneByUuid, findOneByUsername, update,
//   remove, findDocControlIdByOrg, findAllRoles, findAllPermissions, updateRolePermissions,
//   clearUserCache tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { NotFoundException, ConflictException } from '../../common/exceptions';

// Mock Repository
const mockUserRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  softDelete: jest.fn(),
  query: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
};

const mockRoleRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
};

const mockPermissionRepository = {
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

// Mock Cache Manager
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepository },
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepository,
        },
        {
          provide: UuidResolverService,
          useValue: {
            resolveOrganizationId: jest.fn().mockResolvedValue(1),
            resolveProjectId: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should hash password and create user successfully', async () => {
      const dto = {
        username: 'newuser',
        email: 'new@test.com',
        password: 'plaintext',
      };
      mockUserRepository.create.mockReturnValue({ ...dto, password: 'hashed' });
      mockUserRepository.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: expect.not.stringMatching('plaintext'),
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw ConflictException on duplicate entry', async () => {
      const dto = {
        username: 'dupuser',
        email: 'dup@test.com',
        password: 'pass',
      };
      mockUserRepository.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-duplicate errors', async () => {
      const dto = {
        username: 'user',
        email: 'user@test.com',
        password: 'pass',
      };
      const dbError = new Error('Connection lost');
      mockUserRepository.save.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toThrow('Connection lost');
    });

    it('should resolve primaryOrganizationId when provided', async () => {
      const dto = {
        username: 'orguser',
        email: 'org@test.com',
        password: 'pass',
        primaryOrganizationId: 'org-uuid',
      };
      mockUserRepository.create.mockReturnValue({ ...dto, password: 'hashed' });
      mockUserRepository.save.mockResolvedValue({ id: 1 });

      await service.create(dto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ primaryOrganizationId: 1 })
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ user_id: 1, username: 'test' }];
      const mockTotal = 1;

      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, mockTotal]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.findAll();

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toEqual(mockTotal);
      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should apply search filter when provided', async () => {
      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQB);

      await service.findAll({ search: 'john' });

      expect(mockQB.andWhere).toHaveBeenCalledWith(
        '(user.username LIKE :search OR user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
        { search: '%john%' }
      );
    });

    it('should apply roleId filter when provided', async () => {
      const mockQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQB);

      await service.findAll({ roleId: 5 });

      expect(mockQB.andWhere).toHaveBeenCalledWith('role.roleId = :roleId', {
        roleId: 5,
      });
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const mockUser = { user_id: 1, username: 'test' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 1 },
        relations: expect.arrayContaining([
          'preference',
          'assignments',
          'organization',
        ]),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('should return user when found by publicId', async () => {
      const mockUser = {
        user_id: 1,
        publicId: 'uuid-123',
        username: 'test',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOneByUuid('uuid-123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-123' },
        relations: expect.arrayContaining(['preference', 'organization']),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found by publicId', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('bad-uuid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findOneByUsername', () => {
    it('should return user when found', async () => {
      const mockUser = { user_id: 1, username: 'testuser' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOneByUsername('testuser');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user and clear cache', async () => {
      const mockUser = {
        user_id: 1,
        publicId: 'uuid-123',
        username: 'test',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.merge.mockReturnValue({
        ...mockUser,
        firstName: 'New',
      });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        firstName: 'New',
      });

      const result = await service.update('uuid-123', { firstName: 'New' });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalledWith('permissions:user:1');
      expect(result.firstName).toBe('New');
    });

    it('should hash password when provided in update', async () => {
      const mockUser = { user_id: 1, publicId: 'uuid-123' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.merge.mockReturnValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.update('uuid-123', { password: 'newpass' });

      expect(mockUserRepository.merge).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found for update', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('bad-uuid', { firstName: 'X' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete user and clear cache', async () => {
      const mockUser = { user_id: 1, publicId: 'uuid-123' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('uuid-123');

      expect(mockUserRepository.softDelete).toHaveBeenCalledWith(1);
      expect(mockCacheManager.del).toHaveBeenCalledWith('permissions:user:1');
    });

    it('should throw NotFoundException when soft delete affects 0 rows', async () => {
      const mockUser = { user_id: 1, publicId: 'uuid-123' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('uuid-123')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-uuid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findDocControlIdByOrg', () => {
    it('should return user_id when user found for org', async () => {
      mockUserRepository.findOne.mockResolvedValue({ user_id: 42 });

      const result = await service.findDocControlIdByOrg(10);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { primaryOrganizationId: 10 },
      });
      expect(result).toBe(42);
    });

    it('should return null when no user found for org', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findDocControlIdByOrg(99);

      expect(result).toBeNull();
    });
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions if available', async () => {
      const cachedPermissions = ['document.view', 'document.create'];
      mockCacheManager.get.mockResolvedValue(cachedPermissions);

      const result = await service.getUserPermissions(1);

      expect(result).toEqual(cachedPermissions);
      expect(mockCacheManager.get).toHaveBeenCalledWith('permissions:user:1');
      expect(mockUserRepository.query).not.toHaveBeenCalled();
    });

    it('should query DB and cache if not in cache', async () => {
      const dbPermissions = [
        { permission_name: 'document.view' },
        { permission_name: 'document.create' },
      ];
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.query.mockResolvedValue(dbPermissions);

      const result = await service.getUserPermissions(1);

      expect(result).toEqual(['document.view', 'document.create']);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'permissions:user:1',
        ['document.view', 'document.create'],
        1800 * 1000
      );
    });
  });

  describe('findAllRoles', () => {
    it('should return all roles with permissions', async () => {
      const mockRoles = [{ roleId: 1, roleName: 'Admin', permissions: [] }];
      mockRoleRepository.find.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles();

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        relations: ['permissions'],
      });
      expect(result).toEqual(mockRoles);
    });
  });

  describe('findAllPermissions', () => {
    it('should return all permissions', async () => {
      const mockPermissions = [
        { permissionId: 1, permissionName: 'document.view' },
      ];
      mockPermissionRepository.find.mockResolvedValue(mockPermissions);

      const result = await service.findAllPermissions();

      expect(mockPermissionRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockPermissions);
    });
  });

  describe('updateRolePermissions', () => {
    it('should update role permissions successfully', async () => {
      const mockRole = { roleId: 1, roleName: 'Admin', permissions: [] };
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const mockPerms = [
        { permissionId: 1, permissionName: 'doc.view' },
        { permissionId: 2, permissionName: 'doc.create' },
      ];
      mockPermissionRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPerms),
      });
      mockRoleRepository.save.mockResolvedValue({
        ...mockRole,
        permissions: mockPerms,
      });

      const result = await service.updateRolePermissions(1, [1, 2]);

      expect(mockRoleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: mockPerms })
      );
      expect(result.permissions).toHaveLength(2);
    });

    it('should throw NotFoundException when role not found', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRolePermissions(999, [1])).rejects.toThrow(
        NotFoundException
      );
    });

    it('should update role with empty permissions when no IDs provided', async () => {
      const mockRole = { roleId: 1, roleName: 'Admin', permissions: [] };
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockRoleRepository.save.mockResolvedValue(mockRole);

      const result = await service.updateRolePermissions(1, []);

      expect(result.permissions).toEqual([]);
    });
  });

  describe('clearUserCache', () => {
    it('should delete cache key for user', async () => {
      await service.clearUserCache(5);

      expect(mockCacheManager.del).toHaveBeenCalledWith('permissions:user:5');
    });
  });
});
