// File: src/modules/ai/guards/ai-enabled.guard.spec.ts
// Change Log
// - 2026-05-21: เพิ่ม unit tests สำหรับ AiEnabledGuard soft-block behavior.

import { ExecutionContext } from '@nestjs/common';
import { AiEnabledGuard } from './ai-enabled.guard';
import { AiSettingsService } from '../ai-settings.service';
import { UserService } from '../../user/user.service';
import { ServiceUnavailableException } from '../../../common/exceptions';
import { User } from '../../user/entities/user.entity';

describe('AiEnabledGuard', () => {
  const mockSettingsService = {
    getAiFeaturesEnabled: jest.fn(),
  } as unknown as jest.Mocked<Pick<AiSettingsService, 'getAiFeaturesEnabled'>>;
  const mockUserService = {
    getUserPermissions: jest.fn(),
  } as unknown as jest.Mocked<Pick<UserService, 'getUserPermissions'>>;
  const guard = new AiEnabledGuard(
    mockSettingsService as unknown as AiSettingsService,
    mockUserService as unknown as UserService
  );
  const createContext = (user?: Partial<User>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('ควร allow เมื่อ AI features เปิดอยู่', async () => {
    mockSettingsService.getAiFeaturesEnabled.mockResolvedValue(true);
    await expect(
      guard.canActivate(createContext({ user_id: 3 }))
    ).resolves.toBe(true);
    expect(mockUserService.getUserPermissions).not.toHaveBeenCalled();
  });
  it('ควร block regular user ด้วย HTTP 503 เมื่อ AI features ปิด', async () => {
    mockSettingsService.getAiFeaturesEnabled.mockResolvedValue(false);
    mockUserService.getUserPermissions.mockResolvedValue(['ai.suggest']);
    await expect(
      guard.canActivate(createContext({ user_id: 3 }))
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('ควร allow superadmin ที่มีสิทธิ์ AI เมื่อ AI features ปิด', async () => {
    mockSettingsService.getAiFeaturesEnabled.mockResolvedValue(false);
    mockUserService.getUserPermissions.mockResolvedValue([
      'system.manage_all',
      'ai.suggest',
    ]);
    await expect(
      guard.canActivate(createContext({ user_id: 1 }))
    ).resolves.toBe(true);
  });
});
