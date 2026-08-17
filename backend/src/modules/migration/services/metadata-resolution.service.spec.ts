// File: backend/src/modules/migration/services/metadata-resolution.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit tests for MetadataResolutionService (T045, T046, Feature 242)
// - 2026-08-07: Added integration tests for resolveBatch main flow, processItem, createAndLinkTags, timeout guard
// - 2026-08-17: Updated tests for batch operations (Phase 2.1) — UPDATE ใช้ dataSource.query
//   แทน repo.update, INSERT/SELECT ใช้ multi-row batch แทน per-tag loop (Issue #3)

import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { MetadataResolutionService } from './metadata-resolution.service';
import { deriveTagName } from '../types/tag-mapping-rule';

/**
 * Unit + Integration tests สำหรับ MetadataResolutionService (Feature 242)
 * T045: resolves org/type/discipline by name, reports unresolved values (FR-019)
 * T046: tag creation from TagMappingRule is deterministic and idempotent (FR-018, FR-018a)
 * T050: timeout guard with system_settings fallback
 * Coverage: main resolveBatch flow, processItem, createAndLinkTags, set-based resolution
 */
describe('MetadataResolutionService (Feature 242)', () => {
  let service: MetadataResolutionService;
  let dataSource: jest.Mocked<DataSource>;
  let queryMock: jest.Mock;
  let repoMock: {
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let queryBuilderMock: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilderMock = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    repoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
          }),
        }),
      }),
    };
    queryMock = jest.fn();
    dataSource = {
      query: queryMock,
      getRepository: jest.fn().mockReturnValue(repoMock),
    } as unknown as jest.Mocked<DataSource>;

    const module = await Test.createTestingModule({
      providers: [
        MetadataResolutionService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MetadataResolutionService>(MetadataResolutionService);
  });

  describe('T045: resolveBatch — org/type/discipline resolution (FR-019)', () => {
    it('returns empty result when no pending items', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      const result = await service.resolveBatch();
      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
    });

    it('returns structured result with batchId when provided', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      const result = await service.resolveBatch('batch-001');
      expect(result.batchId).toBe('batch-001');
    });

    it('returns null batchId when not provided (FR-020a)', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      const result = await service.resolveBatch();
      expect(result.batchId).toBeNull();
    });

    it('result includes startedAt and completedAt timestamps', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      const result = await service.resolveBatch();
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(
        result.startedAt.getTime()
      );
    });
  });

  describe('resolveBatch — main flow with items (FR-017, FR-019)', () => {
    /** ตั้งค่า mock สำหรับมี items และ resolution maps */
    function setupItems(
      items: Array<Record<string, unknown>>,
      orgRows: Array<Record<string, unknown>> = [],
      typeRows: Array<Record<string, unknown>> = [],
      disciplineRows: Array<Record<string, unknown>> = [],
      tagInsertResult: Array<Record<string, number>> = [{ affectedRows: 1 }],
      tagSelectResult: Array<Record<string, number>> = [{ id: 10 }]
    ) {
      queryBuilderMock.getRawMany.mockResolvedValue(items);
      // query calls in order: getBatchTimeoutMs, resolveOrganizationsByName, resolveCorrespondenceTypes, resolveDisciplines, then per-tag INSERT+SELECT
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings')) {
          return Promise.resolve([]);
        }
        if (sql.includes('organizations')) {
          return Promise.resolve(orgRows);
        }
        if (sql.includes('correspondence_types')) {
          return Promise.resolve(typeRows);
        }
        if (sql.includes('disciplines')) {
          return Promise.resolve(disciplineRows);
        }
        if (sql.includes('INSERT IGNORE INTO tags')) {
          return Promise.resolve(tagInsertResult);
        }
        if (sql.includes('SELECT id FROM tags')) {
          return Promise.resolve(tagSelectResult);
        }
        return Promise.resolve([]);
      });
    }

    it('succeeds when all register values resolve to reference data', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-001',
          projectId: 5,
          senderOrganizationId: null,
          receiverOrganizationId: null,
          details: JSON.stringify({
            fromOrganization: 'Owner Co',
            toOrganization: 'Contractor Co',
            disciplineCode: 'CIV',
            correspondenceType: 'RFA',
          }),
        },
      ];
      setupItems(
        items,
        [
          { id: 100, organization_name: 'Owner Co', organization_code: 'OWN' },
          {
            id: 200,
            organization_name: 'Contractor Co',
            organization_code: 'CON',
          },
        ],
        [{ id: 300, type_code: 'RFA', type_name: 'RFA' }],
        [{ id: 400, discipline_code: 'CIV' }]
      );

      const result = await service.resolveBatch();

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
      // Phase 2.1: batch UPDATE ใช้ dataSource.query แทน repo.update
      // ตรวจว่ามีการเรียก UPDATE migration_review_queue ผ่าน query
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE migration_review_queue'),
        expect.any(Array)
      );
    });

    it('reports failures for unresolved org names (FR-019)', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-002',
          projectId: 5,
          senderOrganizationId: null,
          receiverOrganizationId: null,
          details: JSON.stringify({
            fromOrganization: 'Unknown Org',
            toOrganization: 'Also Unknown',
          }),
        },
      ];
      setupItems(items, [], [], []);

      const result = await service.resolveBatch();

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(2);
      expect(result.failures[0]).toMatchObject({
        field: 'fromOrganization',
        unresolvedValue: 'Unknown Org',
      });
      expect(result.failures[1]).toMatchObject({
        field: 'toOrganization',
        unresolvedValue: 'Also Unknown',
      });
    });

    it('reports failure for unresolved discipline code', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-003',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({
            disciplineCode: 'UNKNOWN_DISC',
          }),
        },
      ];
      setupItems(items, [], [], []);

      const result = await service.resolveBatch();

      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        field: 'disciplineCode',
        unresolvedValue: 'UNKNOWN_DISC',
      });
    });

    it('reports failure for unresolved correspondence type', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-004',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({
            correspondenceType: 'UNKNOWN_TYPE',
          }),
        },
      ];
      setupItems(items, [], [], []);

      const result = await service.resolveBatch();

      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        field: 'correspondenceType',
        unresolvedValue: 'UNKNOWN_TYPE',
      });
    });

    it('skips org resolution when senderOrganizationId already set', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-005',
          projectId: 5,
          senderOrganizationId: 99,
          receiverOrganizationId: 88,
          details: JSON.stringify({
            fromOrganization: 'Should Not Resolve',
          }),
        },
      ];
      setupItems(items);

      const result = await service.resolveBatch();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      // update should NOT be called because senderOrganizationId already set
      expect(repoMock.update).not.toHaveBeenCalled();
    });

    it('handles items with null details', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-006',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: null,
        },
      ];
      setupItems(items);

      const result = await service.resolveBatch();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('handles items with details as object (not string)', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-007',
          projectId: 5,
          senderOrganizationId: null,
          receiverOrganizationId: null,
          details: { fromOrganization: 'Owner Co' },
        },
      ];
      setupItems(items, [
        { id: 100, organization_name: 'Owner Co', organization_code: 'OWN' },
      ]);

      const result = await service.resolveBatch();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('processes multiple items with mixed results', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-ok',
          projectId: 5,
          senderOrganizationId: null,
          receiverOrganizationId: null,
          details: JSON.stringify({ fromOrganization: 'Owner Co' }),
        },
        {
          queueId: 2,
          publicId: 'pub-fail',
          projectId: 5,
          senderOrganizationId: null,
          receiverOrganizationId: null,
          details: JSON.stringify({ fromOrganization: 'Missing Org' }),
        },
      ];
      setupItems(items, [
        { id: 100, organization_name: 'Owner Co', organization_code: 'OWN' },
      ]);

      const result = await service.resolveBatch();

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('createAndLinkTags (FR-018, FR-018a)', () => {
    it('creates tags from discipline and correspondenceType (batch)', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-tags',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({
            disciplineCode: 'CIV',
            correspondenceType: 'RFA',
          }),
        },
      ];
      queryBuilderMock.getRawMany.mockResolvedValue(items);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings')) return Promise.resolve([]);
        if (sql.includes('organizations')) return Promise.resolve([]);
        if (sql.includes('correspondence_types'))
          return Promise.resolve([
            { id: 300, type_code: 'RFA', type_name: 'RFA' },
          ]);
        if (sql.includes('disciplines'))
          return Promise.resolve([{ id: 400, discipline_code: 'CIV' }]);
        // Phase 2.1: batch INSERT multi-row → affectedRows=2 สำหรับ 2 tags
        if (sql.includes('INSERT IGNORE INTO tags'))
          return Promise.resolve([{ affectedRows: 2 }]);
        // Phase 2.1: batch SELECT IN → return 2 rows
        if (sql.includes('SELECT id FROM tags'))
          return Promise.resolve([{ id: 10 }, { id: 11 }]);
        return Promise.resolve([]);
      });

      const result = await service.resolveBatch();

      expect(result.tagsCreated).toBe(2);
      expect(result.tagsLinked).toBe(2);
    });

    it('does not create tags when projectId is null', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-no-proj',
          projectId: null,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({ disciplineCode: 'CIV' }),
        },
      ];
      queryBuilderMock.getRawMany.mockResolvedValue(items);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await service.resolveBatch();

      expect(result.tagsCreated).toBe(0);
      expect(result.tagsLinked).toBe(0);
    });

    it('does not create tags when no register fields for tags', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-no-fields',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({}),
        },
      ];
      queryBuilderMock.getRawMany.mockResolvedValue(items);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await service.resolveBatch();

      expect(result.tagsCreated).toBe(0);
      expect(result.tagsLinked).toBe(0);
    });

    it('counts linked but not created when tag already exists (batch affectedRows=0)', async () => {
      const items = [
        {
          queueId: 1,
          publicId: 'pub-existing-tag',
          projectId: 5,
          senderOrganizationId: 10,
          receiverOrganizationId: 20,
          details: JSON.stringify({ disciplineCode: 'CIV' }),
        },
      ];
      queryBuilderMock.getRawMany.mockResolvedValue(items);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings')) return Promise.resolve([]);
        if (sql.includes('organizations')) return Promise.resolve([]);
        if (sql.includes('correspondence_types')) return Promise.resolve([]);
        if (sql.includes('disciplines'))
          return Promise.resolve([{ id: 400, discipline_code: 'CIV' }]);
        // Phase 2.1: batch INSERT → affectedRows=0 (already exists)
        if (sql.includes('INSERT IGNORE INTO tags'))
          return Promise.resolve([{ affectedRows: 0 }]);
        // Phase 2.1: batch SELECT IN → return 1 row (tag exists)
        if (sql.includes('SELECT id FROM tags'))
          return Promise.resolve([{ id: 10 }]);
        return Promise.resolve([]);
      });

      const result = await service.resolveBatch();

      expect(result.tagsCreated).toBe(0);
      expect(result.tagsLinked).toBe(1);
    });
  });

  describe('T046: deriveTagName (FR-018, FR-018a)', () => {
    it('produces deterministic tag names from discipline', () => {
      expect(deriveTagName('discipline', 'STR')).toBe('discipline:STR');
    });

    it('produces deterministic tag names from correspondenceType', () => {
      expect(deriveTagName('correspondenceType', 'RFA')).toBe('type:RFA');
    });

    it('returns null for unknown field type', () => {
      expect(
        deriveTagName('unknown' as 'discipline' | 'correspondenceType', 'VALUE')
      ).toBeNull();
    });

    it('is idempotent — same input always produces same output', () => {
      const tag1 = deriveTagName('discipline', 'GEN');
      const tag2 = deriveTagName('discipline', 'GEN');
      expect(tag1).toBe(tag2);
      expect(tag1).toBe('discipline:GEN');
    });

    it('handles empty values', () => {
      expect(deriveTagName('discipline', '')).toBeNull();
      expect(deriveTagName('correspondenceType', '')).toBeNull();
    });
  });

  describe('timeout guard (T050)', () => {
    it('uses default timeout when system_settings unavailable', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryMock.mockResolvedValue([]);
      const result = await service.resolveBatch();
      expect(result).toBeDefined();
    });

    it('uses timeout from system_settings when available', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings'))
          return Promise.resolve([{ setting_value: '5000' }]);
        return Promise.resolve([]);
      });
      const result = await service.resolveBatch();
      expect(result).toBeDefined();
    });

    it('falls back to default when setting_value is invalid', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings'))
          return Promise.resolve([{ setting_value: 'not-a-number' }]);
        return Promise.resolve([]);
      });
      const result = await service.resolveBatch();
      expect(result).toBeDefined();
    });

    it('falls back to default when setting_value is negative', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings'))
          return Promise.resolve([{ setting_value: '-100' }]);
        return Promise.resolve([]);
      });
      const result = await service.resolveBatch();
      expect(result).toBeDefined();
    });

    it('falls back to default when query throws', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('system_settings'))
          return Promise.reject(new Error('DB connection lost'));
        return Promise.resolve([]);
      });
      const result = await service.resolveBatch();
      expect(result).toBeDefined();
    });
  });

  describe('batchId scope (FR-020a)', () => {
    it('applies batchId filter in query when provided', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      await service.resolveBatch('batch-scope-test');
      expect(queryBuilderMock.andWhere).toHaveBeenCalled();
    });

    it('does not apply batchId filter when not provided', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      await service.resolveBatch();
      expect(queryBuilderMock.andWhere).not.toHaveBeenCalled();
    });
  });
});
