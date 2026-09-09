// File: backend/src/modules/maintenance/maintenance.service.spec.ts
// Change Log:
// - 2026-09-07: Unit tests for MaintenanceService (Feature 253 — T090)

import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { NumberingToolsService } from './services/numbering-tools.service';
import { OrphanCleanupService } from './services/orphan-cleanup.service';
import { VectorSyncService } from './services/vector-sync.service';
import { EmergencyUnlockService } from './services/emergency-unlock.service';
import { User } from '../user/entities/user.entity';

describe('MaintenanceService (Feature 253 — T090)', () => {
  let service: MaintenanceService;

  const mockNumbering = {
    findGaps: jest.fn().mockResolvedValue([]),
    syncCounters: jest.fn().mockResolvedValue({ updated: 0 }),
    overrideCounter: jest.fn().mockResolvedValue({
      counterKey: 'TEST',
      previousValue: 1,
      newValue: 5,
      voidedNumbers: [2, 3, 4, 5],
    }),
  };

  const mockOrphan = {
    scanOrphans: jest.fn().mockResolvedValue([]),
    purgeOrphans: jest.fn().mockResolvedValue({ deleted: 0, failed: [] }),
  };

  const mockVector = {
    findMissingVectors: jest.fn().mockResolvedValue([]),
    enqueueReEmbed: jest.fn().mockResolvedValue({ queued: true }),
    findOrphanVectors: jest.fn().mockResolvedValue([]),
  };

  const mockEmergency = {
    scanStuckLocks: jest.fn().mockResolvedValue([]),
    forceReleaseLocks: jest.fn().mockResolvedValue([]),
    bulkHardPurge: jest.fn().mockResolvedValue([]),
  };

  const mockUser = { user_id: 1 } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: NumberingToolsService, useValue: mockNumbering },
        { provide: OrphanCleanupService, useValue: mockOrphan },
        { provide: VectorSyncService, useValue: mockVector },
        { provide: EmergencyUnlockService, useValue: mockEmergency },
      ],
    }).compile();

    service = module.get(MaintenanceService);
    jest.clearAllMocks();
  });

  describe('numbering tools', () => {
    it('should delegate gap audit', async () => {
      await service.getNumberingGaps('project-uuid');
      expect(mockNumbering.findGaps).toHaveBeenCalledWith('project-uuid');
    });

    it('should delegate counter sync', async () => {
      const result = await service.syncNumberingCounters();
      expect(result).toEqual({ updated: 0 });
      expect(mockNumbering.syncCounters).toHaveBeenCalledWith(undefined);
    });

    it('should delegate counter override', async () => {
      const result = await service.overrideNumbering(
        'TEST',
        5,
        'correction',
        mockUser
      );
      expect(result.counterKey).toBe('TEST');
      expect(mockNumbering.overrideCounter).toHaveBeenCalledWith(
        'TEST',
        5,
        1,
        'correction'
      );
    });
  });

  describe('orphan cleanup', () => {
    it('should delegate scan', async () => {
      await service.scanOrphans();
      expect(mockOrphan.scanOrphans).toHaveBeenCalled();
    });

    it('should delegate purge with userId', async () => {
      const paths = ['/tmp/orphan.pdf'];
      await service.purgeOrphans(paths, mockUser);
      expect(mockOrphan.purgeOrphans).toHaveBeenCalledWith(paths, 1);
    });
  });

  describe('vector sync', () => {
    it('should delegate missing vector lookup', async () => {
      await service.findMissingVectors('project-uuid');
      expect(mockVector.findMissingVectors).toHaveBeenCalledWith(
        'project-uuid'
      );
    });

    it('should delegate re-embed enqueue', async () => {
      const result = await service.enqueueReEmbed('proj-uuid', 'doc-uuid');
      expect(result).toEqual({ queued: true });
      expect(mockVector.enqueueReEmbed).toHaveBeenCalledWith(
        'proj-uuid',
        'doc-uuid'
      );
    });
  });

  describe('emergency unlock', () => {
    it('should delegate stuck lock scan', async () => {
      await service.scanStuckLocks();
      expect(mockEmergency.scanStuckLocks).toHaveBeenCalled();
    });

    it('should delegate force release', async () => {
      await service.forceReleaseLocks(['lock:foo']);
      expect(mockEmergency.forceReleaseLocks).toHaveBeenCalledWith([
        'lock:foo',
      ]);
    });

    it('should delegate bulk hard purge with user ID', async () => {
      await service.bulkHardPurge(['doc-uuid'], 'CORRESPONDENCE', mockUser);
      expect(mockEmergency.bulkHardPurge).toHaveBeenCalledWith(
        ['doc-uuid'],
        'CORRESPONDENCE',
        '1'
      );
    });
  });
});
