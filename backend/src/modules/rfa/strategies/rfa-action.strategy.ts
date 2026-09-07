// File: backend/src/modules/rfa/strategies/rfa-action.strategy.ts
// บันทึกการแก้ไข: RFA DocumentActionStrategy (Feature 253 — T039)

import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DocumentActionStrategy } from '../../../common/services/document-action-strategy.interface';
import { ActionResult } from '../../../common/interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../../../common/interfaces/hard-delete-cascade-policy.interface';
import { RfaService } from '../rfa.service';
import { DocumentSideEffectsService } from '../../../common/services/document-side-effects.service';

/**
 * Strategy สำหรับ RFA document actions
 * ใช้ RfaService สำหรับ business logic และ DocumentSideEffectsService สำหรับ side effects
 */
@Injectable()
export class RfaActionStrategy implements DocumentActionStrategy {
  readonly documentType = 'RFA';

  constructor(
    private readonly rfaService: RfaService,
    private readonly sideEffects: DocumentSideEffectsService
  ) {}

  /**
   * ยกเลิก RFA — status → CANCELLED (CC), terminate workflow
   * RFA ใช้ rfa_status_codes (CC = Cancelled) ไม่ใช่ correspondence_status
   */
  async cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult> {
    const _result = await this.rfaService.cancel(publicId, {
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
   * ลบถาวร RFA — TODO: Phase 3 hard-delete
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
      tier1: ['subject', 'description', 'remarks'],
      tier2: ['rfaTypeId'],
      tier3: ['rfaNumber'],
    };
  }
}
