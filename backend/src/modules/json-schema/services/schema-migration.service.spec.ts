// File: src/modules/json-schema/services/schema-migration.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ SchemaMigrationService

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SchemaMigrationService } from './schema-migration.service';
import { JsonSchemaService } from '../json-schema.service';

// Helper สร้าง mock QueryRunner
const makeQueryRunner = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    query: jest.fn(),
  },
});

describe('SchemaMigrationService', () => {
  let service: SchemaMigrationService;
  let mockQR: ReturnType<typeof makeQueryRunner>;
  const mockJsonSchemaService = {
    findOneByCodeAndVersion: jest.fn(),
    findLatestByCode: jest.fn(),
    validateData: jest.fn(),
  };

  beforeEach(async () => {
    mockQR = makeQueryRunner();
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQR),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaMigrationService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: JsonSchemaService, useValue: mockJsonSchemaService },
      ],
    }).compile();
    service = module.get<SchemaMigrationService>(SchemaMigrationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('migrateData', () => {
    const targetSchema = {
      version: 2,
      schemaCode: 'RFA_FORM',
      migrationScript: null,
    };

    it('ควรคืน success=true ทันทีเมื่อ currentVersion >= targetVersion', async () => {
      mockJsonSchemaService.findLatestByCode.mockResolvedValueOnce({
        ...targetSchema,
        version: 1,
      });
      mockQR.manager.query.mockResolvedValueOnce([
        { details: { title: 'test' }, schema_version: 1 },
      ]);
      const result = await service.migrateData('rfa_revisions', 1, 'RFA_FORM');
      expect(result.success).toBe(true);
      expect(result.migratedFields).toHaveLength(0);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(1);
    });

    it('ควร throw NotFoundException เมื่อ entity ไม่พบ', async () => {
      mockJsonSchemaService.findLatestByCode.mockResolvedValueOnce(
        targetSchema
      );
      mockQR.manager.query.mockResolvedValueOnce([]); // ไม่มี record
      await expect(
        service.migrateData('rfa_revisions', 999, 'RFA_FORM')
      ).rejects.toThrow();
      expect(mockQR.rollbackTransaction).toHaveBeenCalled();
      expect(mockQR.release).toHaveBeenCalled();
    });

    it('ควร migrate ข้ามไปยัง targetVersion พร้อม commit', async () => {
      // Target = v2, current entity = v1
      mockJsonSchemaService.findLatestByCode.mockResolvedValueOnce(
        targetSchema
      );
      mockQR.manager.query.mockResolvedValueOnce([
        { details: { title: 'old' }, schema_version: 1 },
      ]);
      // v2 migration script
      mockJsonSchemaService.findOneByCodeAndVersion.mockResolvedValueOnce({
        version: 2,
        schemaCode: 'RFA_FORM',
        migrationScript: {
          steps: [
            {
              type: 'FIELD_RENAME',
              config: { old_field: 'title', new_field: 'subject' },
            },
          ],
        },
      });
      mockJsonSchemaService.validateData.mockResolvedValueOnce({
        isValid: true,
        sanitizedData: { subject: 'old' },
      });
      mockQR.manager.query.mockResolvedValueOnce(undefined); // UPDATE
      const result = await service.migrateData('rfa_revisions', 1, 'RFA_FORM');
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.migratedFields).toContain('subject');
      expect(mockQR.commitTransaction).toHaveBeenCalled();
    });

    it('ควร rollback และ throw เมื่อ validation ล้มเหลว', async () => {
      mockJsonSchemaService.findLatestByCode.mockResolvedValueOnce(
        targetSchema
      );
      mockQR.manager.query.mockResolvedValueOnce([
        { details: { title: 'old' }, schema_version: 1 },
      ]);
      mockJsonSchemaService.findOneByCodeAndVersion.mockResolvedValueOnce({
        version: 2,
        migrationScript: { steps: [] },
      });
      mockJsonSchemaService.validateData.mockResolvedValueOnce({
        isValid: false,
        sanitizedData: null,
      });
      let error: any;
      try {
        await service.migrateData('rfa_revisions', 1, 'RFA_FORM');
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.code).toBe('SCHEMA_MIGRATION_VALIDATION_FAILED');
      expect(mockQR.rollbackTransaction).toHaveBeenCalled();
    });

    it('ควรดึง schema ด้วย version ที่ระบุ เมื่อส่ง targetVersion', async () => {
      mockJsonSchemaService.findOneByCodeAndVersion.mockResolvedValueOnce(
        targetSchema
      );
      mockQR.manager.query.mockResolvedValueOnce([
        { details: {}, schema_version: 2 },
      ]); // already up-to-date
      await service.migrateData('rfa_revisions', 1, 'RFA_FORM', 2);
      expect(
        mockJsonSchemaService.findOneByCodeAndVersion
      ).toHaveBeenCalledWith('RFA_FORM', 2);
    });
  });

  describe('applyMigrationStep (private — tested via migrateData)', () => {
    const runStep = async (
      step: Record<string, unknown>,
      data: Record<string, unknown>
    ) => {
      const targetSchema = {
        version: 2,
        schemaCode: 'TEST',
        migrationScript: { steps: [step] },
      };
      mockJsonSchemaService.findLatestByCode.mockResolvedValueOnce(
        targetSchema
      );
      mockQR.manager.query.mockResolvedValueOnce([
        { details: data, schema_version: 1 },
      ]);
      mockJsonSchemaService.findOneByCodeAndVersion.mockResolvedValueOnce(
        targetSchema
      );
      let capturedData: Record<string, unknown> = {};
      mockJsonSchemaService.validateData.mockImplementationOnce(
        (_code: string, d: Record<string, unknown>) => {
          capturedData = d;
          return Promise.resolve({ isValid: true, sanitizedData: d });
        }
      );
      mockQR.manager.query.mockResolvedValueOnce(undefined);
      await service.migrateData('test_table', 1, 'TEST');
      return capturedData;
    };

    it('FIELD_RENAME: ควรเปลี่ยนชื่อ field', async () => {
      const result = await runStep(
        {
          type: 'FIELD_RENAME',
          config: { old_field: 'title', new_field: 'subject' },
        },
        { title: 'Hello' }
      );
      expect(result['subject']).toBe('Hello');
      expect(result['title']).toBeUndefined();
    });

    it('FIELD_ADD: ควรเพิ่ม field ด้วย default value', async () => {
      const result = await runStep(
        {
          type: 'FIELD_ADD',
          config: { field: 'newField', default_value: 'N/A' },
        },
        { existing: 'data' }
      );
      expect(result['newField']).toBe('N/A');
    });

    it('FIELD_ADD: ควรไม่ overwrite field ที่มีอยู่แล้ว', async () => {
      const result = await runStep(
        {
          type: 'FIELD_ADD',
          config: { field: 'existing', default_value: 'N/A' },
        },
        { existing: 'original' }
      );
      expect(result['existing']).toBe('original');
    });

    it('FIELD_REMOVE: ควรลบ field', async () => {
      const result = await runStep(
        { type: 'FIELD_REMOVE', config: { field: 'toRemove' } },
        { toRemove: 'bye', keep: 'yes' }
      );
      expect(result['toRemove']).toBeUndefined();
      expect(result['keep']).toBe('yes');
    });

    it('FIELD_TRANSFORM MAP_VALUES: ควร map ค่าตาม mapping', async () => {
      const result = await runStep(
        {
          type: 'FIELD_TRANSFORM',
          config: {
            field: 'status',
            transform: 'MAP_VALUES',
            mapping: { DRAFT: 'IN_DRAFT' },
          },
        },
        { status: 'DRAFT' }
      );
      expect(result['status']).toBe('IN_DRAFT');
    });

    it('FIELD_TRANSFORM TO_NUMBER: ควรแปลง string เป็น number', async () => {
      const result = await runStep(
        {
          type: 'FIELD_TRANSFORM',
          config: { field: 'amount', transform: 'TO_NUMBER' },
        },
        { amount: '42' }
      );
      expect(result['amount']).toBe(42);
    });

    it('FIELD_TRANSFORM TO_STRING: ควรแปลง number เป็น string', async () => {
      const result = await runStep(
        {
          type: 'FIELD_TRANSFORM',
          config: { field: 'code', transform: 'TO_STRING' },
        },
        { code: 123 }
      );
      expect(result['code']).toBe('123');
    });

    it('STRUCTURE_CHANGE (unknown step type): ควร warn และไม่ crash', async () => {
      const result = await runStep(
        { type: 'STRUCTURE_CHANGE', config: {} },
        { key: 'value' }
      );
      expect(result['key']).toBe('value'); // ไม่ถูกแตะ
    });
  });
});
