// File: src/modules/ai/intent-classifier/controllers/intent-admin.controller.spec.ts
// Change Log
// - 2026-05-21: แก้ไขไทป์ให้ตรงกับ Enum ล่าสุด
// - 2026-05-19: สร้าง Integration test สำหรับ Admin API (T016, US1).

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  IntentAdminController,
  IntentPatternAdminController,
} from './intent-admin.controller';
import { IntentDefinitionService } from '../services/intent-definition.service';
import { IntentPatternService } from '../services/intent-pattern.service';
import {
  IntentCategory,
  PatternType,
} from '../interfaces/intent-category.enum';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';

/** Guard stub ที่ allow ทุก request */
const mockGuard = { canActivate: () => true };

describe('IntentAdminController', () => {
  let controller: IntentAdminController;
  let definitionService: jest.Mocked<IntentDefinitionService>;
  let patternService: jest.Mocked<IntentPatternService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntentAdminController],
      providers: [
        {
          provide: IntentDefinitionService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findByCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: IntentPatternService,
          useValue: {
            findByIntentCode: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
          },
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)

      .useValue(mockGuard)

      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<IntentAdminController>(IntentAdminController);
    definitionService = module.get(IntentDefinitionService);
    patternService = module.get(IntentPatternService);
  });

  describe('findAll', () => {
    it('ควรเรียก service.findAll พร้อม filter', async () => {
      await controller.findAll(IntentCategory.READ, 'true');

      expect(definitionService.findAll).toHaveBeenCalledWith({
        category: 'read',
        isActive: true,
      });
    });

    it('ควรเรียก service.findAll โดยไม่มี filter', async () => {
      await controller.findAll();

      expect(definitionService.findAll).toHaveBeenCalledWith({
        category: undefined,
        isActive: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('ควรเรียก service.findByCode', async () => {
      definitionService.findByCode.mockResolvedValue({
        intentCode: 'GET_RFA',
      } as never);

      const result = await controller.findOne('GET_RFA');

      expect(definitionService.findByCode).toHaveBeenCalledWith('GET_RFA');
      expect(result).toEqual({ intentCode: 'GET_RFA' });
    });
  });

  describe('create', () => {
    it('ควรเรียก service.create ด้วย dto', async () => {
      const dto = {
        intentCode: 'TEST',
        descriptionTh: 'ทดสอบ',
        descriptionEn: 'Test',
        category: IntentCategory.UTILITY,
      };
      definitionService.create.mockResolvedValue({
        ...dto,
        publicId: 'uuid-1',
      } as never);

      await controller.create(dto);

      expect(definitionService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('ควรเรียก service.update ด้วย intentCode + dto', async () => {
      definitionService.update.mockResolvedValue({
        intentCode: 'GET_RFA',
        descriptionTh: 'อัปเดต',
      } as never);

      await controller.update('GET_RFA', { descriptionTh: 'อัปเดต' });

      expect(definitionService.update).toHaveBeenCalledWith('GET_RFA', {
        descriptionTh: 'อัปเดต',
      });
    });
  });

  describe('findPatterns', () => {
    it('ควรเรียก patternService.findByIntentCode', async () => {
      await controller.findPatterns('GET_RFA');

      expect(patternService.findByIntentCode).toHaveBeenCalledWith('GET_RFA');
    });
  });

  describe('createPattern', () => {
    it('ควร merge intentCode กับ dto', async () => {
      const dto = { patternType: PatternType.KEYWORD, patternValue: 'rfa' };
      patternService.create.mockResolvedValue({ publicId: 'p-1' } as never);

      await controller.createPattern('GET_RFA', dto);

      expect(patternService.create).toHaveBeenCalledWith({
        intentCode: 'GET_RFA',
        ...dto,
      });
    });
  });
});

describe('IntentPatternAdminController', () => {
  let controller: IntentPatternAdminController;
  let patternService: jest.Mocked<IntentPatternService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntentPatternAdminController],
      providers: [
        {
          provide: IntentPatternService,
          useValue: {
            findByPublicId: jest.fn(),
            update: jest.fn(),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        Reflector,
      ],
    })

      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<IntentPatternAdminController>(
      IntentPatternAdminController
    );
    patternService = module.get(IntentPatternService);
  });

  describe('findOne', () => {
    it('ควรเรียก service.findByPublicId', async () => {
      patternService.findByPublicId.mockResolvedValue({
        publicId: 'p-1',
      } as never);

      const result = await controller.findOne('p-1');

      expect(patternService.findByPublicId).toHaveBeenCalledWith('p-1');
      expect(result).toEqual({ publicId: 'p-1' });
    });
  });

  describe('update', () => {
    it('ควรเรียก service.update', async () => {
      patternService.update.mockResolvedValue({ publicId: 'p-1' } as never);

      await controller.update('p-1', { patternValue: 'new' });

      expect(patternService.update).toHaveBeenCalledWith('p-1', {
        patternValue: 'new',
      });
    });
  });

  describe('remove', () => {
    it('ควรเรียก service.remove', async () => {
      await controller.remove('p-1');

      expect(patternService.remove).toHaveBeenCalledWith('p-1');
    });
  });
});
