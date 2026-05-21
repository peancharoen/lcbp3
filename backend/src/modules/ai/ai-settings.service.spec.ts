// File: src/modules/ai/ai-settings.service.spec.ts
// Change Log
// - 2026-05-21: เพิ่ม regression tests สำหรับ AI feature toggle cache/DB behavior.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiSettingsService } from './ai-settings.service';
import { SystemSetting } from './entities/system-setting.entity';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AiSettingsService', () => {
  const mockSettingRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  let service: AiSettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSettingsService,
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: mockSettingRepo,
        },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<AiSettingsService>(AiSettingsService);
  });

  it('ควรอ่านค่า enabled จาก Redis cache เมื่อมีค่าอยู่แล้ว', async () => {
    mockRedis.get.mockResolvedValue('false');

    await expect(service.getAiFeaturesEnabled()).resolves.toBe(false);
    expect(mockSettingRepo.findOne).not.toHaveBeenCalled();
  });

  it('ควร fallback ไป DB และเขียน cache เมื่อ Redis cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockSettingRepo.findOne.mockResolvedValue({ settingValue: 'true' });

    await expect(service.getAiFeaturesEnabled()).resolves.toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'system_settings:AI_FEATURES_ENABLED',
      'true',
      'EX',
      30
    );
  });

  it('ควรอัปเดต DB ใน transaction แล้ว invalid cache หลังสำเร็จ', async () => {
    const transactionalRepo = {
      findOne: jest.fn().mockResolvedValue({ settingValue: 'true' }),
      save: jest.fn().mockResolvedValue({ settingValue: 'false' }),
      create: jest.fn(),
    };
    mockSettingRepo.manager.transaction.mockImplementation(
      async (
        callback: (manager: {
          getRepository: () => typeof transactionalRepo;
        }) => Promise<void>
      ) => callback({ getRepository: () => transactionalRepo })
    );

    await service.setAiFeaturesEnabled(false, 7);

    expect(transactionalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ settingValue: 'false', updatedBy: 7 })
    );
    expect(mockRedis.del).toHaveBeenCalledWith(
      'system_settings:AI_FEATURES_ENABLED'
    );
  });
});
