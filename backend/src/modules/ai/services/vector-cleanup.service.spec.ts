// File: backend/src/modules/ai/services/vector-cleanup.service.spec.ts
// Change Log:
// - 2026-09-03: Unit tests สำหรับ VectorCleanupService — retry pending + orphan scan

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VectorCleanupService } from './vector-cleanup.service';
import { AiQdrantService } from '../qdrant.service';
import {
  PendingVectorDeletion,
  PendingVectorDeletionStatus,
} from '../entities/pending-vector-deletion.entity';

describe('VectorCleanupService', () => {
  let service: VectorCleanupService;
  let qdrantService: jest.Mocked<AiQdrantService>;
  let pendingRepo: jest.Mocked<Repository<PendingVectorDeletion>>;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    const mockQdrant = {
      deleteByDocumentPublicId: jest.fn().mockResolvedValue(undefined),
      scrollByProject: jest
        .fn()
        .mockResolvedValue({ points: [], nextOffset: null }),
      deleteByPointIds: jest.fn().mockResolvedValue(undefined),
    };

    const mockPendingRepo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorCleanupService,
        { provide: AiQdrantService, useValue: mockQdrant },
        {
          provide: getRepositoryToken(PendingVectorDeletion),
          useValue: mockPendingRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<VectorCleanupService>(VectorCleanupService);
    qdrantService = module.get(AiQdrantService);
    pendingRepo = module.get(getRepositoryToken(PendingVectorDeletion));
    dataSource = module.get(DataSource);
  });

  describe('retryPendingDeletions', () => {
    it('ควรลบ vectors สำเร็จและ mark COMPLETED', async () => {
      const pendingItem = {
        id: 1,
        publicId: 'pvd-uuid-1',
        documentPublicId: 'doc-uuid-1',
        projectPublicId: 'proj-uuid-1',
        status: PendingVectorDeletionStatus.PENDING,
        retryCount: 0,
        maxRetries: 10,
      } as PendingVectorDeletion;

      pendingRepo.find.mockResolvedValue([pendingItem]);

      await service.retryPendingDeletions();

      expect(qdrantService.deleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-uuid-1',
        'doc-uuid-1'
      );
      expect(pendingRepo.update).toHaveBeenCalledWith(1, {
        status: PendingVectorDeletionStatus.COMPLETED,
        completedAt: expect.any(Date),
      });
    });

    it('ควร increment retryCount เมื่อ Qdrant deletion fail', async () => {
      const pendingItem = {
        id: 2,
        publicId: 'pvd-uuid-2',
        documentPublicId: 'doc-uuid-2',
        projectPublicId: 'proj-uuid-2',
        status: PendingVectorDeletionStatus.PENDING,
        retryCount: 2,
        maxRetries: 10,
      } as PendingVectorDeletion;

      pendingRepo.find.mockResolvedValue([pendingItem]);
      qdrantService.deleteByDocumentPublicId.mockRejectedValueOnce(
        new Error('Qdrant connection refused')
      );

      await service.retryPendingDeletions();

      expect(pendingRepo.update).toHaveBeenCalledWith(2, {
        retryCount: 3,
        lastError: 'Qdrant connection refused',
      });
    });

    it('ควร mark FAILED เมื่อ retryCount เกิน maxRetries', async () => {
      const pendingItem = {
        id: 3,
        publicId: 'pvd-uuid-3',
        documentPublicId: 'doc-uuid-3',
        projectPublicId: 'proj-uuid-3',
        status: PendingVectorDeletionStatus.PENDING,
        retryCount: 9,
        maxRetries: 10,
      } as PendingVectorDeletion;

      pendingRepo.find.mockResolvedValue([pendingItem]);
      qdrantService.deleteByDocumentPublicId.mockRejectedValueOnce(
        new Error('Qdrant down')
      );

      await service.retryPendingDeletions();

      expect(pendingRepo.update).toHaveBeenCalledWith(3, {
        status: PendingVectorDeletionStatus.FAILED,
        retryCount: 10,
        lastError: 'Qdrant down',
      });
    });

    it('ควร handle empty pending list โดยไม่ throw', async () => {
      pendingRepo.find.mockResolvedValue([]);

      await expect(service.retryPendingDeletions()).resolves.not.toThrow();
      expect(qdrantService.deleteByDocumentPublicId).not.toHaveBeenCalled();
    });
  });

  describe('orphanScan', () => {
    it('ควร handle empty projects list โดยไม่ throw', async () => {
      dataSource.query.mockResolvedValue([]);

      await expect(service.orphanScan()).resolves.not.toThrow();
      expect(qdrantService.scrollByProject).not.toHaveBeenCalled();
    });

    it('ควรลบ orphan vectors ที่ไม่มี doc_public_id ตรงใน DB', async () => {
      // 1 project with 2 vectors: 1 existing, 1 orphan
      dataSource.query
        .mockResolvedValueOnce([{ public_id: 'proj-uuid-1' }])
        .mockResolvedValueOnce([{ public_id: 'doc-existing-uuid' }]);

      qdrantService.scrollByProject.mockResolvedValueOnce({
        points: [
          {
            pointId: 'point-1',
            score: 0,
            payload: { doc_public_id: 'doc-existing-uuid' },
          },
          {
            pointId: 'point-2',
            score: 0,
            payload: { doc_public_id: 'doc-orphan-uuid' },
          },
        ],
        nextOffset: null,
      });

      await service.orphanScan();

      expect(qdrantService.deleteByPointIds).toHaveBeenCalledWith(['point-2']);
    });

    it('ควร scroll batch ต่อเมื่อ nextOffset ไม่ใช่ null', async () => {
      dataSource.query.mockResolvedValue([{ public_id: 'proj-uuid-1' }]);
      dataSource.query.mockResolvedValueOnce([{ public_id: 'proj-uuid-1' }]);
      dataSource.query.mockResolvedValueOnce([]);

      qdrantService.scrollByProject
        .mockResolvedValueOnce({
          points: [
            {
              pointId: 'p1',
              score: 0,
              payload: { doc_public_id: 'doc-1' },
            },
          ],
          nextOffset: 'offset-1',
        })
        .mockResolvedValueOnce({
          points: [],
          nextOffset: null,
        });

      await service.orphanScan();

      expect(qdrantService.scrollByProject).toHaveBeenCalledTimes(2);
    });
  });
});
