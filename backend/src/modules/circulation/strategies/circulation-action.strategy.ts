// File: backend/src/modules/circulation/strategies/circulation-action.strategy.ts
// บันทึกการแก้ไข: Circulation DocumentActionStrategy (Feature 253 — T045)

import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DocumentActionStrategy } from '../../../common/services/document-action-strategy.interface';
import { ActionResult } from '../../../common/interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../../../common/interfaces/hard-delete-cascade-policy.interface';
import { DocumentSideEffectsService } from '../../../common/services/document-side-effects.service';
import { CirculationService } from '../circulation.service';

/**
 * Strategy สำหรับ Circulation document actions
 * Circulation ใช้ force-close (ไม่ใช่ cancel) — statusCode → CLOSED
 */
@Injectable()
export class CirculationActionStrategy implements DocumentActionStrategy {
  readonly documentType = 'CIRCULATION';

  constructor(
    private readonly circulationService: CirculationService,
    private readonly sideEffects: DocumentSideEffectsService
  ) {}

  /**
   * Force-close Circulation — statusCode → CLOSED + forceCloseReason
   * ใช้ forceClose แทน cancel (ตาม spec FR-006)
   */
  async cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult> {
    // Delegate to existing CirculationService.forceClose()
    // Note: forceClose uses its own transaction — we pass our queryRunner
    // but the existing service creates its own. For now, we call it directly.
    // TODO: Refactor to use shared queryRunner for atomic transaction
    await this.circulationService.forceClose(
      publicId,
      'Document action: force close',
      { user_id: userId } as never
    );

    const outcome = await this.sideEffects.executeCritical({
      publicId,
      documentType: this.documentType,
      userId,
      queryRunner,
    });

    return {
      success: true,
      publicId,
      action: 'CANCEL',
      sideEffects: {
        searchReindexed: outcome.searchReindexed,
        notificationsSent: outcome.notificationsSent,
        workflowTerminated: outcome.workflowTerminated,
        circulationsClosed: outcome.circulationsClosed,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * ลบถาวร Circulation — TODO: Phase 3 hard-delete
   */
  hardDelete(
    publicId: string,
    _userId: string,
    _queryRunner: QueryRunner
  ): Promise<ActionResult> {
    return Promise.resolve({
      success: false,
      publicId,
      action: 'HARD_DELETE',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: ['hard-delete not yet implemented'],
      auditId: '',
    });
  }

  /**
   * แก้ไข metadata — TODO: Phase 4 metadata patch
   */
  metadataPatch(
    publicId: string,
    _patch: Record<string, string | number | boolean | null>,
    _version: number,
    _userId: string,
    _queryRunner: QueryRunner
  ): Promise<ActionResult> {
    return Promise.resolve({
      success: false,
      publicId,
      action: 'METADATA_PATCH',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: ['metadata-patch not yet implemented'],
      auditId: '',
    });
  }

  getCascadePolicy(): HardDeleteCascadePolicy {
    return {
      deleteRelated: async () => {
        await Promise.resolve();
        return { filesToDelete: [] };
      },
      getStorageFiles: async () => {
        await Promise.resolve();
        return [];
      },
      deleteVectors: async () => {
        await Promise.resolve();
      },
    };
  }

  getPatchableFields() {
    return {
      tier1: ['subject', 'deadlineDate'],
      tier2: ['organizationId'],
      tier3: [],
    };
  }
}
