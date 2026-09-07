// File: backend/src/modules/correspondence/strategies/correspondence-action.strategy.ts
// บันทึกการแก้ไข: Correspondence DocumentActionStrategy (Feature 253 — T037)

import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DocumentActionStrategy } from '../../../common/services/document-action-strategy.interface';
import { ActionResult } from '../../../common/interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../../../common/interfaces/hard-delete-cascade-policy.interface';
import { CorrespondenceService } from '../correspondence.service';
import { DocumentSideEffectsService } from '../../../common/services/document-side-effects.service';

/**
 * Strategy สำหรับ Correspondence document actions
 * ใช้ CorrespondenceService สำหรับ business logic และ DocumentSideEffectsService สำหรับ side effects
 */
@Injectable()
export class CorrespondenceActionStrategy implements DocumentActionStrategy {
  readonly documentType = 'CORRESPONDENCE';

  constructor(
    private readonly correspondenceService: CorrespondenceService,
    private readonly sideEffects: DocumentSideEffectsService
  ) {}

  /**
   * ยกเลิก Correspondence — status → CANCELLED, force-close circulations, terminate workflow
   */
  async cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult> {
    // Delegate to existing service — it already handles circulation force-close + workflow termination
    // The service returns void; we wrap in ActionResult
    // Note: correspondenceService.cancel() uses its own transaction — we pass our queryRunner
    // but the existing service creates its own. For now, we call it directly and let it manage its own transaction.
    // TODO: Refactor to use shared queryRunner for atomic transaction
    const _result = await this.correspondenceService.cancel(publicId, '', {
      user_id: userId,
    } as never);

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
   * ลบถาวร Correspondence — TODO: Phase 3 hard-delete
   */
  hardDelete(
    publicId: string,
    _userId: string,
    _queryRunner: QueryRunner
  ): Promise<ActionResult> {
    // TODO: T044 — implement hard-delete cascade for Correspondence
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
    // TODO: T050+ — implement metadata patch for Correspondence
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
    // TODO: implement cascade policy for Correspondence hard-delete
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
      tier1: ['subject', 'description', 'remarks', 'tags'],
      tier2: ['originatorId', 'disciplineId'],
      tier3: ['correspondenceNumber'],
    };
  }
}
