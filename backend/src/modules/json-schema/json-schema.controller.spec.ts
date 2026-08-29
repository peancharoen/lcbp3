// File: backend/src/modules/json-schema/json-schema.controller.spec.ts
// Change Log:
// - 2026-09-15: Extended with create, findAll, findOne, findLatest, update, remove,
//   validate, processReadData, migrateData endpoint tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { JsonSchemaController } from './json-schema.controller';
import { JsonSchemaService } from './json-schema.service';
import { SchemaMigrationService } from './services/schema-migration.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';

describe('JsonSchemaController', () => {
  let controller: JsonSchemaController;

  const mockJsonSchemaService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findLatestByCode: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    validateData: jest.fn(),
    processReadData: jest.fn(),
  };

  const mockSchemaMigrationService = {
    migrateData: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JsonSchemaController],
      providers: [
        { provide: JsonSchemaService, useValue: mockJsonSchemaService },
        {
          provide: SchemaMigrationService,
          useValue: mockSchemaMigrationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JsonSchemaController>(JsonSchemaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call jsonSchemaService.create with DTO', async () => {
      const dto = { code: 'RFA_DWG', version: 1, schema: {} };
      const mockResult = { id: 1, ...dto };
      mockJsonSchemaService.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(mockJsonSchemaService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when create fails', async () => {
      mockJsonSchemaService.create.mockRejectedValue(
        new Error('Schema already exists')
      );

      await expect(controller.create({} as never)).rejects.toThrow(
        'Schema already exists'
      );
    });
  });

  describe('findAll', () => {
    it('should call jsonSchemaService.findAll with search DTO', async () => {
      const searchDto = { code: 'RFA', page: 1, limit: 10 };
      const mockResult = { data: [], total: 0 };
      mockJsonSchemaService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(searchDto);

      expect(mockJsonSchemaService.findAll).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should call findAll with empty search DTO', async () => {
      mockJsonSchemaService.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll({} as never);

      expect(mockJsonSchemaService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should call jsonSchemaService.findOne with id', async () => {
      const mockSchema = { id: 5, code: 'RFA_DWG' };
      mockJsonSchemaService.findOne.mockResolvedValue(mockSchema);

      const result = await controller.findOne(5);

      expect(mockJsonSchemaService.findOne).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockSchema);
    });

    it('should propagate error when schema not found', async () => {
      mockJsonSchemaService.findOne.mockRejectedValue(
        new Error('Schema not found')
      );

      await expect(controller.findOne(999)).rejects.toThrow('Schema not found');
    });
  });

  describe('findLatest', () => {
    it('should call jsonSchemaService.findLatestByCode with code', async () => {
      const mockSchema = { id: 10, code: 'RFA_DWG', version: 3 };
      mockJsonSchemaService.findLatestByCode.mockResolvedValue(mockSchema);

      const result = await controller.findLatest('RFA_DWG');

      expect(mockJsonSchemaService.findLatestByCode).toHaveBeenCalledWith(
        'RFA_DWG'
      );
      expect(result).toEqual(mockSchema);
    });

    it('should propagate error when latest schema not found', async () => {
      mockJsonSchemaService.findLatestByCode.mockRejectedValue(
        new Error('No schema found')
      );

      await expect(controller.findLatest('UNKNOWN')).rejects.toThrow(
        'No schema found'
      );
    });
  });

  describe('update', () => {
    it('should call jsonSchemaService.update with id and DTO', async () => {
      const dto = { schema: { updated: true } };
      const mockResult = { id: 5, schema: { updated: true } };
      mockJsonSchemaService.update.mockResolvedValue(mockResult);

      const result = await controller.update(5, dto);

      expect(mockJsonSchemaService.update).toHaveBeenCalledWith(5, dto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when update fails', async () => {
      mockJsonSchemaService.update.mockRejectedValue(
        new Error('Cannot update active schema')
      );

      await expect(controller.update(1, {} as never)).rejects.toThrow(
        'Cannot update active schema'
      );
    });
  });

  describe('remove', () => {
    it('should call jsonSchemaService.remove with id', async () => {
      mockJsonSchemaService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(5);

      expect(mockJsonSchemaService.remove).toHaveBeenCalledWith(5);
      expect(result).toBeUndefined();
    });

    it('should propagate error when remove fails', async () => {
      mockJsonSchemaService.remove.mockRejectedValue(
        new Error('Cannot delete')
      );

      await expect(controller.remove(1)).rejects.toThrow('Cannot delete');
    });
  });

  describe('validate', () => {
    it('should call jsonSchemaService.validateData with code and data', async () => {
      const data = { field1: 'value1' };
      const mockResult = { valid: true, errors: [] };
      mockJsonSchemaService.validateData.mockResolvedValue(mockResult);

      const result = await controller.validate('RFA_DWG', data);

      expect(mockJsonSchemaService.validateData).toHaveBeenCalledWith(
        'RFA_DWG',
        data
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when validation fails', async () => {
      mockJsonSchemaService.validateData.mockRejectedValue(
        new Error('Invalid schema code')
      );

      await expect(controller.validate('BAD_CODE', {})).rejects.toThrow(
        'Invalid schema code'
      );
    });
  });

  describe('processReadData', () => {
    it('should extract roles from string array and call processReadData', async () => {
      const data = { field1: 'value1' };
      const mockUser = {
        user_id: 1,
        roles: ['ADMIN', 'VIEWER'],
      } as unknown as User;
      const mockResult = { processed: true };
      mockJsonSchemaService.processReadData.mockResolvedValue(mockResult);

      const result = await controller.processReadData(
        'RFA_DWG',
        data,
        mockUser
      );

      expect(mockJsonSchemaService.processReadData).toHaveBeenCalledWith(
        'RFA_DWG',
        data,
        {
          userRoles: ['ADMIN', 'VIEWER'],
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should extract roles from object array with roleName', async () => {
      const data = { field1: 'value1' };
      const mockUser = {
        user_id: 1,
        roles: [{ roleName: 'ADMIN' }, { roleName: 'EDITOR' }],
      } as unknown as User;
      mockJsonSchemaService.processReadData.mockResolvedValue({ ok: true });

      await controller.processReadData('RFA_DWG', data, mockUser);

      expect(mockJsonSchemaService.processReadData).toHaveBeenCalledWith(
        'RFA_DWG',
        data,
        {
          userRoles: ['ADMIN', 'EDITOR'],
        }
      );
    });

    it('should pass empty roles when user has no roles property', async () => {
      const data = { field1: 'value1' };
      const mockUser = { user_id: 1 } as unknown as User;
      mockJsonSchemaService.processReadData.mockResolvedValue({ ok: true });

      await controller.processReadData('RFA_DWG', data, mockUser);

      expect(mockJsonSchemaService.processReadData).toHaveBeenCalledWith(
        'RFA_DWG',
        data,
        { userRoles: [] }
      );
    });

    it('should propagate error when processReadData fails', async () => {
      mockJsonSchemaService.processReadData.mockRejectedValue(
        new Error('Decryption failed')
      );

      await expect(
        controller.processReadData('RFA_DWG', {}, {
          user_id: 1,
        } as unknown as User)
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('migrateData', () => {
    it('should call migrationService.migrateData with table, id, code, and version', async () => {
      const dto = { targetSchemaCode: 'RFA_DWG', targetVersion: 2 };
      const mockResult = { migrated: true };
      mockSchemaMigrationService.migrateData.mockResolvedValue(mockResult);

      const result = await controller.migrateData('rfa_revisions', 42, dto);

      expect(mockSchemaMigrationService.migrateData).toHaveBeenCalledWith(
        'rfa_revisions',
        42,
        'RFA_DWG',
        2
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when migration fails', async () => {
      mockSchemaMigrationService.migrateData.mockRejectedValue(
        new Error('Migration failed')
      );

      await expect(
        controller.migrateData('rfa_revisions', 1, {
          targetSchemaCode: 'BAD',
          targetVersion: 99,
        })
      ).rejects.toThrow('Migration failed');
    });
  });
});
