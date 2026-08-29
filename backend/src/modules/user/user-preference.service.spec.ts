// File: src/modules/user/user-preference.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ UserPreferenceService (T1.3)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserPreferenceService } from './user-preference.service';
import { UserPreference } from './entities/user-preference.entity';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

describe('UserPreferenceService', () => {
  let service: UserPreferenceService;

  const mockPrefRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(
      (target: Record<string, unknown>, source: Record<string, unknown>) => {
        Object.assign(target, source);
        return target;
      }
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferenceService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: mockPrefRepo,
        },
      ],
    }).compile();

    service = module.get<UserPreferenceService>(UserPreferenceService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUser', () => {
    it('ควรคืน preference ที่มีอยู่แล้ว', async () => {
      const existingPref: Partial<UserPreference> = {
        userId: 1,
        notifyEmail: true,
        notifyLine: false,
        digestMode: true,
        uiTheme: 'dark',
      };
      mockPrefRepo.findOne.mockResolvedValue(existingPref);

      const result = await service.findByUser(1);

      expect(result).toEqual(existingPref);
      expect(mockPrefRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
      expect(mockPrefRepo.create).not.toHaveBeenCalled();
    });

    it('ควรสร้าง default preference เมื่อไม่มีอยู่แล้ว', async () => {
      mockPrefRepo.findOne.mockResolvedValue(null);
      const createdPref: Partial<UserPreference> = {
        userId: 5,
        notifyEmail: true,
        notifyLine: true,
        digestMode: false,
        uiTheme: 'light',
      };
      mockPrefRepo.create.mockReturnValue(createdPref);
      mockPrefRepo.save.mockResolvedValue(createdPref);

      const result = await service.findByUser(5);

      expect(mockPrefRepo.create).toHaveBeenCalledWith({
        userId: 5,
        notifyEmail: true,
        notifyLine: true,
        digestMode: false,
        uiTheme: 'light',
      });
      expect(mockPrefRepo.save).toHaveBeenCalledWith(createdPref);
      expect(result).toEqual(createdPref);
    });
  });

  describe('update', () => {
    it('ควร merge และ save preference ที่อัปเดต', async () => {
      const existingPref: Partial<UserPreference> = {
        userId: 2,
        notifyEmail: true,
        notifyLine: true,
        digestMode: false,
        uiTheme: 'light',
      };
      mockPrefRepo.findOne.mockResolvedValue(existingPref);
      const mergedPref: Partial<UserPreference> = {
        ...existingPref,
        uiTheme: 'dark',
        digestMode: true,
      };
      mockPrefRepo.save.mockResolvedValue(mergedPref);

      const dto: UpdatePreferenceDto = {
        uiTheme: 'dark',
        digestMode: true,
      };

      const result = await service.update(2, dto);

      expect(mockPrefRepo.merge).toHaveBeenCalledWith(existingPref, dto);
      expect(mockPrefRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ uiTheme: 'dark', digestMode: true })
      );
      expect(result).toEqual(mergedPref);
    });

    it('ควรสร้าง default ก่อน merge เมื่อไม่มี preference อยู่', async () => {
      mockPrefRepo.findOne.mockResolvedValue(null);
      const createdPref: Partial<UserPreference> = {
        userId: 3,
        notifyEmail: true,
        notifyLine: true,
        digestMode: false,
        uiTheme: 'light',
      };
      mockPrefRepo.create.mockReturnValue(createdPref);
      mockPrefRepo.save
        .mockResolvedValueOnce(createdPref)
        .mockResolvedValueOnce({ ...createdPref, uiTheme: 'dark' });

      const dto: UpdatePreferenceDto = { uiTheme: 'dark' };

      const result = await service.update(3, dto);

      expect(mockPrefRepo.create).toHaveBeenCalled();
      expect(mockPrefRepo.merge).toHaveBeenCalledWith(createdPref, dto);
      expect(mockPrefRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ uiTheme: 'dark' })
      );
      expect(result).toEqual({ ...createdPref, uiTheme: 'dark' });
    });
  });
});
