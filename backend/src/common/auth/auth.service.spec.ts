import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';

// Mock bcrypt at top level
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let tokenRepo: Repository<RefreshToken>;

  const mockUser = {
    user_id: 1,
    username: 'testuser',
    password: 'hashedpassword',
    primaryOrganizationId: 1,
  };

  const mockQueryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(mockUser),
  };

  const mockUserRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockTokenRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    // Reset bcrypt mocks
    bcrypt.compare.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findOneByUsername: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('jwt_token'),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key.includes('EXPIRATION')) return '1h';
              return 'secret';
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            set: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    tokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password if validation succeeds', async () => {
      const result = await service.validateUser('testuser', 'password');
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result.username).toBe('testuser');
    });

    it('should return null if user not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);
      const result = await service.validateUser('unknown', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password mismatch', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);
      const result = await service.validateUser('testuser', 'wrongpassword');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      mockTokenRepo.create.mockReturnValue({ id: 1 });
      mockTokenRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.login(mockUser);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockTokenRepo.save).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      (userService.findOneByUsername as jest.Mock).mockResolvedValue(null);
      (userService.create as jest.Mock).mockResolvedValue(mockUser);

      const dto = {
        username: 'newuser',
        password: 'password',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await service.register(dto);
      expect(result).toBeDefined();
      expect(userService.create).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens if valid', async () => {
      const mockStoredToken = {
        tokenHash: 'somehash',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 10000),
      };
      mockTokenRepo.findOne.mockResolvedValue(mockStoredToken);
      (userService.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.refreshToken(1, 'valid_refresh_token');

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      // Should mark old token as revoked
      expect(mockTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true })
      );
    });

    it('should throw UnauthorizedException if token revoked', async () => {
      const mockStoredToken = {
        tokenHash: 'somehash',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 10000),
      };
      mockTokenRepo.findOne.mockResolvedValue(mockStoredToken);

      await expect(service.refreshToken(1, 'revoked_token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
