// File: backend/src/modules/ai/services/ai-execution-profiles.service.spec.ts
// Change Log:
// - 2026-06-15: สร้าง unit test สำหรับ AiExecutionProfilesService ครอบคลุม CRUD และ error handling (T044, T054)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiExecutionProfilesService } from './ai-execution-profiles.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { CreateExecutionProfileDto } from '../dto/create-execution-profile.dto';
import { UpdateExecutionProfileDto } from '../dto/update-execution-profile.dto';
import {
  BusinessException,
  NotFoundException,
} from '../../../common/exceptions';

/**
 * Unit tests สำหรับ AiExecutionProfilesService
 * ครอบคลุม: findAll, findOneById, findActive, create, update, delete, setActive
 * รวม error paths ตาม ADR-007 layered classification
 */
describe('AiExecutionProfilesService', () => {
  let service: AiExecutionProfilesService;
  let profileRepo: jest.Mocked<Repository<AiExecutionProfile>>;

  const mockProfile: AiExecutionProfile = {
    id: 1,
    profileName: 'standard',
    canonicalModel: 'np-dms-ai',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    numCtx: 8192,
    repeatPenalty: 1.1,
    keepAliveSeconds: 300,
    isActive: false,
    updatedBy: 1,
    createdAt: new Date('2026-06-15T00:00:00Z'),
    updatedAt: new Date('2026-06-15T00:00:00Z'),
  };

  const mockActiveProfile: AiExecutionProfile = {
    ...mockProfile,
    id: 2,
    profileName: 'active-profile',
    isActive: true,
  };

  const createDto: CreateExecutionProfileDto = {
    profileName: 'new-profile',
    temperature: 0.5,
    topP: 0.8,
    repeatPenalty: 1.2,
    keepAlive: 600,
    ctxSize: 16384,
  };

  const updateDto: UpdateExecutionProfileDto = {
    temperature: 0.3,
    ctxSize: 4096,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiExecutionProfilesService,
        {
          provide: getRepositoryToken(AiExecutionProfile),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiExecutionProfilesService>(
      AiExecutionProfilesService
    );
    profileRepo = module.get(getRepositoryToken(AiExecutionProfile));
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('ควรดึงรายการโปรไฟล์ทั้งหมดเรียงตาม createdAt ASC', async () => {
      profileRepo.find.mockResolvedValue([mockProfile, mockActiveProfile]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(profileRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });

    it('ควร propagate error เมื่อ repository reject (return ไม่ await → catch ไม่ทำงาน)', async () => {
      profileRepo.find.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.findAll()).rejects.toThrow('DB connection lost');
    });

    it('ควร throw BusinessException เมื่อ repository throw sync error (catch ทำงาน)', async () => {
      profileRepo.find.mockImplementation(() => {
        throw new Error('sync error');
      });

      await expect(service.findAll()).rejects.toThrow(BusinessException);
    });
  });

  describe('findOneById', () => {
    it('ควรคืนโปรไฟล์เมื่อเจอ', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);

      const result = await service.findOneById(1);

      expect(result.id).toBe(1);
      expect(profileRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('ควร throw NotFoundException เมื่อไม่เจอ', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneById(999)).rejects.toThrow(NotFoundException);
    });

    it('ควร re-throw NotFoundException โดยไม่ wrap เป็น BusinessException', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneById(999)).rejects.toThrow(NotFoundException);
      // ยืนยันว่าไม่ได้ถูก catch ใน generic handler (เพราะ instanceof NotFoundException)
    });

    it('ควร throw BusinessException เมื่อ repository error ที่ไม่ใช่ NotFoundException', async () => {
      profileRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.findOneById(1)).rejects.toThrow(BusinessException);
    });
  });

  describe('findActive', () => {
    it('ควรคืน active profile เมื่อเจอ', async () => {
      profileRepo.findOne.mockResolvedValue(mockActiveProfile);

      const result = await service.findActive();

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(true);
      expect(profileRepo.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('ควรคืน null เมื่อไม่มี active profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      const result = await service.findActive();

      expect(result).toBeNull();
    });

    it('ควร propagate error เมื่อ repository reject (return ไม่ await → catch ไม่ทำงาน)', async () => {
      profileRepo.findOne.mockRejectedValue(new Error('Redis down'));

      await expect(service.findActive()).rejects.toThrow('Redis down');
    });
  });

  describe('create', () => {
    it('ควรสร้างโปรไฟล์ใหม่สำเร็จ พร้อม map ctxSize → numCtx', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      const createdProfile = { ...mockProfile, ...createDto, numCtx: 16384 };
      profileRepo.create.mockReturnValue(createdProfile);
      profileRepo.save.mockResolvedValue(createdProfile);

      const result = await service.create(createDto, 1);

      expect(result.profileName).toBe('new-profile');
      expect(profileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          numCtx: 16384,
          updatedBy: 1,
        })
      );
      expect(profileRepo.save).toHaveBeenCalledWith(createdProfile);
    });

    it('ควร throw BusinessException เมื่อ profileName ซ้ำ', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);

      await expect(
        service.create({ ...createDto, profileName: 'standard' }, 1)
      ).rejects.toThrow(BusinessException);
    });

    it('ควร re-throw BusinessException โดยไม่ wrap ซ้ำ', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);

      await expect(
        service.create({ ...createDto, profileName: 'standard' }, 1)
      ).rejects.toThrow(BusinessException);
    });

    it('ควร propagate error เมื่อ save ล้มเหลว (return ไม่ await → catch ไม่ทำงาน)', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      profileRepo.create.mockReturnValue({ ...mockProfile });
      profileRepo.save.mockRejectedValue(new Error('DB write failed'));

      await expect(service.create(createDto, 1)).rejects.toThrow(
        'DB write failed'
      );
    });
  });

  describe('update', () => {
    it('ควรอัปเดตโปรไฟล์สำเร็จ พร้อม map ctxSize → numCtx', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.save.mockResolvedValue({
        ...mockProfile,
        ...updateDto,
        numCtx: 4096,
      });

      const result = await service.update(1, updateDto, 2);

      expect(result.temperature).toBe(0.3);
      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          numCtx: 4096,
          updatedBy: 2,
        })
      );
    });

    it('ควร re-throw NotFoundException เมื่อไม่เจอ profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateDto, 2)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร re-throw BusinessException เมื่อเกิด business error', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      const bizError = new BusinessException(
        'TEST_CODE',
        'test',
        'test user msg'
      );
      profileRepo.save.mockRejectedValue(bizError);

      await expect(service.update(1, updateDto, 2)).rejects.toThrow(
        BusinessException
      );
    });

    it('ควร propagate error เมื่อ save error ทั่วไป (return ไม่ await → catch ไม่ทำงาน)', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.update(1, updateDto, 2)).rejects.toThrow('DB error');
    });
  });

  describe('delete', () => {
    it('ควรลบโปรไฟล์สำเร็จเมื่อ isActive = false', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.remove.mockResolvedValue(mockProfile);

      await service.delete(1);

      expect(profileRepo.remove).toHaveBeenCalledWith(mockProfile);
    });

    it('ควร throw BusinessException เมื่อพยายามลบ active profile', async () => {
      profileRepo.findOne.mockResolvedValue(mockActiveProfile);

      await expect(service.delete(2)).rejects.toThrow(BusinessException);
      expect(profileRepo.remove).not.toHaveBeenCalled();
    });

    it('ควร re-throw NotFoundException เมื่อไม่เจอ profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BusinessException เมื่อ remove error ทั่วไป', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.remove.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(BusinessException);
    });
  });

  describe('setActive', () => {
    it('ควรตั้งค่า active สำเร็จ ปิด active เดิม แล้วเปิดใหม่', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.update.mockResolvedValue({ affected: 1, raw: {} });
      profileRepo.save.mockResolvedValue({
        ...mockProfile,
        isActive: true,
        updatedBy: 3,
      });

      const result = await service.setActive(1, 3);

      expect(result.isActive).toBe(true);
      expect(profileRepo.update).toHaveBeenCalledWith(
        { isActive: true },
        { isActive: false, updatedBy: 3 }
      );
      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          updatedBy: 3,
        })
      );
    });

    it('ควร re-throw NotFoundException เมื่อไม่เจอ profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.setActive(999, 3)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw BusinessException เมื่อ update error ทั่วไป', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(service.setActive(1, 3)).rejects.toThrow(BusinessException);
    });

    it('ควร propagate error เมื่อ save error ทั่วไป (return ไม่ await → catch ไม่ทำงาน)', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.update.mockResolvedValue({ affected: 1, raw: {} });
      profileRepo.save.mockRejectedValue(new Error('DB save error'));

      await expect(service.setActive(1, 3)).rejects.toThrow('DB save error');
    });
  });

  describe('non-Error rejection coverage', () => {
    it('findAll: ควร throw BusinessException เมื่อ sync non-Error', async () => {
      profileRepo.find.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string-error';
      });

      await expect(service.findAll()).rejects.toThrow(BusinessException);
    });

    it('findOneById: ควร throw BusinessException เมื่อ reject non-Error', async () => {
      profileRepo.findOne.mockRejectedValue('non-error');

      await expect(service.findOneById(1)).rejects.toThrow(BusinessException);
    });

    it('findActive: ควรคืน null เมื่อ sync Error', async () => {
      profileRepo.findOne.mockImplementation(() => {
        throw new Error('sync error');
      });

      const result = await service.findActive();

      expect(result).toBeNull();
    });

    it('findActive: ควรคืน null เมื่อ sync non-Error', async () => {
      profileRepo.findOne.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string-error';
      });

      const result = await service.findActive();

      expect(result).toBeNull();
    });

    it('create: ควร throw BusinessException เมื่อ findOne reject generic Error', async () => {
      profileRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto, 1)).rejects.toThrow(
        BusinessException
      );
    });

    it('create: ควร throw BusinessException เมื่อ findOne reject non-Error', async () => {
      profileRepo.findOne.mockRejectedValue('non-error');

      await expect(service.create(createDto, 1)).rejects.toThrow(
        BusinessException
      );
    });

    it('update: ควร throw BusinessException เมื่อ save throw sync non-Error', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.save.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'sync-non-error';
      });

      await expect(service.update(1, updateDto, 2)).rejects.toThrow(
        BusinessException
      );
    });

    it('delete: ควร throw BusinessException เมื่อ remove reject non-Error', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.remove.mockRejectedValue('non-error');

      await expect(service.delete(1)).rejects.toThrow(BusinessException);
    });

    it('setActive: ควร throw BusinessException เมื่อ update reject non-Error', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      profileRepo.update.mockRejectedValue('non-error');

      await expect(service.setActive(1, 3)).rejects.toThrow(BusinessException);
    });
  });
});
