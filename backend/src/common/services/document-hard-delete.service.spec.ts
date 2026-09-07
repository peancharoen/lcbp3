// File: backend/src/common/services/document-hard-delete.service.spec.ts
// Change Log:
// - 2026-09-07: Unit tests สำหรับ DocumentHardDeleteService (Feature 253 — T065)

import { DataSource, QueryRunner } from 'typeorm';
import Redis from 'ioredis';
import { DocumentHardDeleteService } from './document-hard-delete.service';
import { HardDeleteCascadePolicy } from '../interfaces/hard-delete-cascade-policy.interface';
import { AiQdrantService } from '../../modules/ai/qdrant.service';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(undefined),
}));

describe('DocumentHardDeleteService', () => {
  let service: DocumentHardDeleteService;
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockRedis: Partial<Redis>;
  let mockQdrant: Partial<AiQdrantService>;
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { query: jest.Mock; delete: jest.Mock };
  };
  let mockLock: { release: jest.Mock };

  const mockPolicy: HardDeleteCascadePolicy = {
    deleteRelated: jest.fn().mockResolvedValue({
      filesToDelete: ['/data/a.pdf', '/data/b.pdf'],
      projectPublicId: 'proj-uuid-1',
    }),
    getStorageFiles: jest
      .fn()
      .mockResolvedValue(['/data/a.pdf', '/data/b.pdf']),
    deleteVectors: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: { query: jest.fn(), delete: jest.fn() },
    };
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    mockRedis = {}; // Redlock ต้องการ Redis instance — mock เป็น object เปล่า
    mockQdrant = {
      deleteByDocumentPublicId: jest.fn().mockResolvedValue(undefined),
    };

    service = new DocumentHardDeleteService(
      mockDataSource as unknown as DataSource,
      mockRedis as Redis,
      mockQdrant as AiQdrantService
    );

    // Mock Redlock acquire/release
    mockLock = { release: jest.fn().mockResolvedValue(undefined) };
    const redlock = (service as unknown as { redlock: { acquire: jest.Mock } })
      .redlock;
    redlock.acquire = jest.fn().mockResolvedValue(mockLock);
  });

  describe('execute', () => {
    it('should acquire lock, run cascade, commit, delete files, release lock', async () => {
      const result = await service.execute({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        cascadePolicy: mockPolicy,
      });

      const redlock = (
        service as unknown as { redlock: { acquire: jest.Mock } }
      ).redlock;
      expect(redlock.acquire).toHaveBeenCalledWith(
        ['lock:hard-delete:corr-uuid-1'],
        10000
      );
      expect(mockPolicy.deleteRelated).toHaveBeenCalledWith(
        'corr-uuid-1',
        mockQueryRunner
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.action).toBe('HARD_DELETE');
      expect(result.sideEffects.filesDeleted).toBe(2);
      expect(result.failedSideEffects).toEqual([]);
    });

    it('should rollback and release lock when cascade fails', async () => {
      (mockPolicy.deleteRelated as jest.Mock).mockRejectedValueOnce(
        new Error('FK constraint')
      );

      await expect(
        service.execute({
          publicId: 'corr-uuid-1',
          documentType: 'CORRESPONDENCE',
          userId: '1',
          cascadePolicy: mockPolicy,
        })
      ).rejects.toThrow('FK constraint');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should report failed file deletions in failedSideEffects', async () => {
      const fs = jest.requireMock<{
        pathExists: jest.Mock;
        remove: jest.Mock;
      }>('fs-extra');
      fs.remove.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.execute({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        cascadePolicy: mockPolicy,
      });

      expect(result.success).toBe(true);
      expect(result.sideEffects.filesDeleted).toBe(1);
      expect(result.failedSideEffects).toContain('storage:/data/a.pdf');
    });

    it('should release lock even when lock.release fails', async () => {
      mockLock.release.mockRejectedValueOnce(new Error('lock expired'));

      const result = await service.execute({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        cascadePolicy: mockPolicy,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('buildCascadePolicy (T068)', () => {
    it('should throw NotFound for CIRCULATION (not supported)', () => {
      expect(() => service.buildCascadePolicy('CIRCULATION')).toThrow();
    });

    it('should return correspondence-root policy for CORRESPONDENCE', async () => {
      const mockQr = {
        manager: { query: jest.fn().mockResolvedValue(undefined) },
      } as unknown as QueryRunner;

      // Mock resolve + attachment collection via dataSource.query
      const ds = service as unknown as {
        dataSource: { query: jest.Mock };
      };
      ds.dataSource = {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 7 }]) // resolve correspondence id
          .mockResolvedValueOnce([{ public_id: 'proj-uuid-1' }]) // resolve project publicId
          .mockResolvedValueOnce([{ id: 1, file_path: '/data/x.pdf' }]),
      };

      const policy = service.buildCascadePolicy('CORRESPONDENCE');
      const { filesToDelete } = await policy.deleteRelated(
        'corr-uuid-1',
        mockQr
      );

      const queries = (mockQr.manager.query as jest.Mock).mock.calls.map(
        (c: [string, unknown[]]) => c[0]
      );
      expect(queries.some((q) => q.includes('circulations'))).toBe(true);
      expect(queries.some((q) => q.includes('workflow_instances'))).toBe(true);
      expect(queries.some((q) => q.includes('correspondences'))).toBe(true);
      expect(filesToDelete).toEqual(['/data/x.pdf']);
    });

    it('should return drawing policy for DRAWING', async () => {
      const mockQr = {
        manager: { query: jest.fn().mockResolvedValue(undefined) },
      } as unknown as QueryRunner;

      const ds = service as unknown as {
        dataSource: { query: jest.Mock };
      };
      ds.dataSource = {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 9 }]) // resolve drawing id
          .mockResolvedValueOnce([{ public_id: 'proj-uuid-1' }]) // resolve project publicId
          .mockResolvedValueOnce([]),
      };

      const policy = service.buildCascadePolicy('DRAWING');
      const { filesToDelete } = await policy.deleteRelated(
        'dwg-uuid-1',
        mockQr
      );

      const queries = (mockQr.manager.query as jest.Mock).mock.calls.map(
        (c: [string, unknown[]]) => c[0]
      );
      expect(queries.some((q) => q.includes('contract_drawings'))).toBe(true);
      expect(filesToDelete).toEqual([]);
    });

    it('should throw NotFound when document not found', async () => {
      const mockQr = {
        manager: { query: jest.fn() },
      } as unknown as QueryRunner;

      const ds = service as unknown as {
        dataSource: { query: jest.Mock };
      };
      ds.dataSource = { query: jest.fn().mockResolvedValue([]) };

      const policy = service.buildCascadePolicy('RFA');
      await expect(
        policy.deleteRelated('missing-uuid', mockQr)
      ).rejects.toThrow();
    });
  });
});
