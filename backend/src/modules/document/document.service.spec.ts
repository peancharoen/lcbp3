// File: backend/src/modules/document/document.service.spec.ts
// Change Log:
// - 2026-09-07: Unit tests for DocumentService bulk cancel / tag / export (Feature 253 — T074)

import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import {
  DocumentService,
  BulkCancelJobData,
  BulkTagJobData,
  BulkExportJobData,
} from './document.service';
import { CorrespondenceService } from '../correspondence/correspondence.service';
import { RfaService } from '../rfa/rfa.service';
import { TransmittalService } from '../transmittal/transmittal.service';
import { ContractDrawingService } from '../drawing/contract-drawing.service';
import { CirculationService } from '../circulation/circulation.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { ExportFormat } from '../../common/dto/bulk-export.dto';
import { User } from '../user/entities/user.entity';

describe('DocumentService (Feature 253 — T074)', () => {
  let service: DocumentService;
  const mockUser = { user_id: 42 } as User;

  const correspondenceService = {
    cancel: jest.fn().mockResolvedValue({ success: true }),
    addTag: jest.fn().mockResolvedValue({}),
    removeTag: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneByUuid: jest.fn().mockResolvedValue({
      correspondenceNumber: 'CORR-001',
      subject: 'Test Subject',
      status: 'DRAFT',
      createdAt: new Date('2026-01-01'),
      fromOrganization: 'Org A',
      toOrganization: 'Org B',
      documentDate: new Date('2026-01-01'),
    }),
  };

  const rfaService = {
    cancel: jest.fn().mockResolvedValue({ success: true }),
    findOneByUuid: jest.fn().mockResolvedValue({
      rfaNo: 'RFA-001',
      subject: 'RFA Subject',
      status: 'OPEN',
      createdAt: new Date('2026-01-01'),
      rfaType: 'RFI',
      discipline: 'CIVIL',
    }),
  };

  const transmittalService = {
    cancel: jest.fn().mockResolvedValue({ success: true }),
    findOneByUuid: jest.fn().mockResolvedValue({
      transmittalNo: 'TRN-001',
      subject: 'TRN Subject',
      status: 'DRAFT',
      createdAt: new Date('2026-01-01'),
      sender: 'Sender',
      recipient: 'Recipient',
    }),
  };

  const contractDrawingService = {
    remove: jest.fn().mockResolvedValue({}),
    findOneByUuid: jest.fn().mockResolvedValue({
      drawingNo: 'DWG-001',
      title: 'Drawing Title',
      status: 'DRAFT',
      createdAt: new Date('2026-01-01'),
      revision: 'A',
      discipline: 'ARCH',
    }),
  };

  const circulationService = {
    forceClose: jest.fn().mockResolvedValue({ success: true }),
  };

  const uuidResolver = {
    resolveCorrespondenceId: jest.fn().mockResolvedValue(7),
    resolve: jest.fn().mockResolvedValue(9),
  };

  // สร้าง Redlock จริงด้วย Redis mock — FR-041
  const mockRedis = {
    defineCommand: jest.fn(),
  } as unknown as Redis;

  const mockLock = {
    release: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedlock = {
    acquire: jest.fn().mockResolvedValue(mockLock),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockResolvedValue({}),
    }),
  };

  const mockBulkQueue = { add: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentService(
      correspondenceService as unknown as CorrespondenceService,
      rfaService as unknown as RfaService,
      transmittalService as unknown as TransmittalService,
      contractDrawingService as unknown as ContractDrawingService,
      circulationService as unknown as CirculationService,
      uuidResolver as unknown as UuidResolverService,
      mockDataSource as unknown as DataSource,
      mockBulkQueue as unknown as Queue,
      mockRedis
    );
    // Override Redlock เพื่อ unit test ไม่ต้องใช้ Redis จริง (FR-041)
    (service as unknown as { redlock: typeof mockRedlock }).redlock =
      mockRedlock;

    // Simulate BullMQ worker processing synchronously in unit tests
    mockBulkQueue.add.mockImplementation(async (_name, data) => {
      if ((data as BulkCancelJobData).type === 'cancel') {
        await service.processCancelJob(data as BulkCancelJobData);
      } else if ((data as BulkTagJobData).type === 'tag') {
        await service.processTagJob(data as BulkTagJobData);
      } else if ((data as BulkExportJobData).type === 'export') {
        await service.processExportJob(data as BulkExportJobData);
      }
      return { id: (data as { bulkId: string }).bulkId };
    });
  });

  describe('bulkCancel', () => {
    it('should cancel all CORRESPONDENCE publicIds and return bulkId', async () => {
      const { bulkId } = await service.bulkCancel(
        ['uuid-1', 'uuid-2'],
        'CORRESPONDENCE',
        'reason',
        mockUser
      );

      expect(bulkId).toBeDefined();

      const progress = service.getBulkProgress(bulkId);

      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(2);
      expect(progress.failed).toBe(0);
      expect(correspondenceService.cancel).toHaveBeenCalledTimes(2);
    });

    it('should dispatch RFA cancel to RfaService', async () => {
      const { bulkId } = await service.bulkCancel(
        ['uuid-1'],
        'RFA',
        'reason',
        mockUser
      );

      expect(rfaService.cancel).toHaveBeenCalledWith('uuid-1', mockUser);
      expect(service.getBulkProgress(bulkId).completed).toBe(1);
    });

    it('should dispatch TRANSMITTAL cancel to TransmittalService', async () => {
      const { bulkId } = await service.bulkCancel(
        ['uuid-1'],
        'TRANSMITTAL',
        'reason',
        mockUser
      );

      expect(transmittalService.cancel).toHaveBeenCalledWith(
        'uuid-1',
        'reason',
        mockUser
      );
      expect(service.getBulkProgress(bulkId).completed).toBe(1);
    });

    it('should dispatch CIRCULATION to forceClose', async () => {
      const { bulkId } = await service.bulkCancel(
        ['uuid-1'],
        'CIRCULATION',
        'reason',
        mockUser
      );

      expect(circulationService.forceClose).toHaveBeenCalledWith(
        'uuid-1',
        'reason',
        mockUser
      );
      expect(service.getBulkProgress(bulkId).completed).toBe(1);
    });

    it('should report partial failures', async () => {
      correspondenceService.cancel.mockRejectedValueOnce(new Error('bad'));

      const { bulkId } = await service.bulkCancel(
        ['uuid-1', 'uuid-2'],
        'CORRESPONDENCE',
        'reason',
        mockUser
      );

      const progress = service.getBulkProgress(bulkId);

      expect(progress.completed).toBe(1);
      expect(progress.failed).toBe(1);
    });

    it('should acquire and release Redlock per publicId for bulk cancel (FR-041)', async () => {
      await service.bulkCancel(
        ['uuid-1', 'uuid-2'],
        'CORRESPONDENCE',
        'reason',
        mockUser
      );

      expect(mockRedlock.acquire).toHaveBeenCalledTimes(2);
      expect(mockRedlock.acquire).toHaveBeenNthCalledWith(
        1,
        ['lock:bulk-cancel:uuid-1'],
        10000
      );
      expect(mockRedlock.acquire).toHaveBeenNthCalledWith(
        2,
        ['lock:bulk-cancel:uuid-2'],
        10000
      );
      expect(mockLock.release).toHaveBeenCalledTimes(2);
    });

    it('should skip CORRESPONDENCE documents already CANCELLED (FR-018)', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ uuid: 'uuid-2' }]);

      const { bulkId } = await service.bulkCancel(
        ['uuid-1', 'uuid-2'],
        'CORRESPONDENCE',
        'reason',
        mockUser
      );

      expect(mockDataSource.query).toHaveBeenCalled();
      expect(correspondenceService.cancel).toHaveBeenCalledTimes(1);
      expect(correspondenceService.cancel).toHaveBeenCalledWith(
        'uuid-1',
        'reason',
        mockUser
      );
      const progress = service.getBulkProgress(bulkId);
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(2);
    });
  });

  describe('bulkTag', () => {
    it('should add/remove tags for CORRESPONDENCE', async () => {
      const { bulkId } = await service.bulkTag(
        ['uuid-1'],
        'CORRESPONDENCE',
        [1, 2],
        [3]
      );

      expect(uuidResolver.resolveCorrespondenceId).toHaveBeenCalledWith(
        'uuid-1'
      );
      expect(correspondenceService.addTag).toHaveBeenCalledWith(7, 1);
      expect(correspondenceService.addTag).toHaveBeenCalledWith(7, 2);
      expect(correspondenceService.removeTag).toHaveBeenCalledWith(7, 3);
      expect(service.getBulkProgress(bulkId).completed).toBe(1);
    });

    it('should fail for unsupported document type', async () => {
      const { bulkId } = await service.bulkTag(['uuid-1'], 'RFA', [1], []);

      expect(service.getBulkProgress(bulkId).failed).toBe(1);
    });
  });

  describe('bulkExport', () => {
    it('should generate CSV with metadata and set downloadUrl', async () => {
      const { bulkId } = await service.bulkExport(
        ['uuid-1', 'uuid-2'],
        'CORRESPONDENCE',
        ExportFormat.CSV,
        undefined,
        mockUser
      );

      const progress = service.getBulkProgress(bulkId);
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(2);
      expect(progress.downloadUrl).toContain(
        `/documents/bulk/${bulkId}/download`
      );

      const file = service.getBulkDownload(bulkId);
      expect(file).toBeDefined();
      expect(file?.mimeType).toBe('text/csv');
      const csvContent = file?.buffer.toString('utf-8') ?? '';
      // CSV should contain BOM + header with document-type-specific columns
      expect(csvContent).toContain('publicId');
      expect(csvContent).toContain('documentNo');
      expect(csvContent).toContain('CORRESPONDENCE');
      expect(csvContent).toContain('CORR-001');
    });
  });

  describe('getBulkProgress', () => {
    it('should throw NotFoundException for unknown bulkId', () => {
      expect(() =>
        service.getBulkProgress('019abc01-0000-7000-8000-000000000000')
      ).toThrow();
    });
  });
});
