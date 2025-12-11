// File: src/modules/user/user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

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
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockUserRepository, // Reuse generic mock
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: mockUserRepository, // Reuse generic mock
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
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
});
