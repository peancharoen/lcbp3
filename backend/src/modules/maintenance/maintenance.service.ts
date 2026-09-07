// File: backend/src/modules/maintenance/maintenance.service.ts
// Change Log:
// - 2026-09-07: Aggregator service for Maintenance Console (Feature 253 — T090-T097)

import { Injectable } from '@nestjs/common';
import { NumberingToolsService } from './services/numbering-tools.service';
import { OrphanCleanupService } from './services/orphan-cleanup.service';
import { VectorSyncService } from './services/vector-sync.service';
import { EmergencyUnlockService } from './services/emergency-unlock.service';
import { User } from '../user/entities/user.entity';

/**
 * Aggregator สำหรับ Maintenance Console
 * รวม Numbering / Orphan / Vector / Emergency Unlock
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly numberingTools: NumberingToolsService,
    private readonly orphanCleanup: OrphanCleanupService,
    private readonly vectorSync: VectorSyncService,
    private readonly emergencyUnlock: EmergencyUnlockService
  ) {}

  async getNumberingGaps(projectId?: string) {
    return await this.numberingTools.findGaps(projectId);
  }

  async syncNumberingCounters(projectId?: string) {
    return await this.numberingTools.syncCounters(projectId);
  }

  async overrideNumbering(
    counterKey: string,
    newLastNumber: number,
    user: User
  ) {
    return await this.numberingTools.overrideCounter(
      counterKey,
      newLastNumber,
      user.user_id
    );
  }

  async scanOrphans() {
    return await this.orphanCleanup.scanOrphans();
  }

  async purgeOrphans(paths: string[], user: User) {
    return await this.orphanCleanup.purgeOrphans(paths, user.user_id);
  }

  async findMissingVectors(projectId?: string) {
    return await this.vectorSync.findMissingVectors(projectId);
  }

  async enqueueReEmbed(projectPublicId: string, documentPublicId: string) {
    return await this.vectorSync.enqueueReEmbed(
      projectPublicId,
      documentPublicId
    );
  }

  async findOrphanVectors(projectId?: string) {
    return await this.vectorSync.findOrphanVectors(projectId);
  }

  async scanStuckLocks() {
    return await this.emergencyUnlock.scanStuckLocks();
  }

  async forceReleaseLocks(lockKeys: string[]) {
    return await this.emergencyUnlock.forceReleaseLocks(lockKeys);
  }

  async bulkHardPurge(
    publicIds: string[],
    documentType: 'CORRESPONDENCE' | 'RFA' | 'TRANSMITTAL' | 'DRAWING',
    user: User
  ) {
    return await this.emergencyUnlock.bulkHardPurge(
      publicIds,
      documentType,
      user.user_id.toString()
    );
  }
}
