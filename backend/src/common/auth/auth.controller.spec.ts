import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: Partial<AuthService>;

  beforeEach(async () => {
    mockAuthService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return tokens when credentials are valid', async () => {
      const loginDto = { username: 'test', password: 'password' };
      const mockUser = { user_id: 1, username: 'test' };
      const mockTokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        user: mockUser,
      };

      (mockAuthService.validateUser as jest.Mock).mockResolvedValue(mockUser);
      (mockAuthService.login as jest.Mock).mockResolvedValue(mockTokens);

      const result = await controller.login(loginDto);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test',
        'password'
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      const loginDto = { username: 'test', password: 'wrong' };
      (mockAuthService.validateUser as jest.Mock).mockResolvedValue(null);

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        username: 'newuser',
        password: 'password',
        email: 'test@test.com',
        display_name: 'Test User',
      };
      const mockUser = { user_id: 1, ...registerDto };

      (mockAuthService.register as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });
});
