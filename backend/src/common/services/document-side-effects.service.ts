// File: backend/src/common/services/document-side-effects.service.ts
// บันทึกการแก้ไข: Side-effects orchestration for document actions (Feature 253 — T010+T011)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueryRunner } from 'typeorm';
import { SideEffectsResult } from '../interfaces/action-result.interface';

/** BullMQ queue name สำหรับ document side effects */
export const DOCUMENT_SIDE_EFFECTS_QUEUE = 'document-side-effects';

/** Job types สำหรับ non-critical side effects */
export enum SideEffectJobType {
  SEARCH_REINDEX = 'search-reindex',
  NOTIFICATION = 'notification',
  VECTOR_DELETE = 'vector-delete',
}

/**
 * Input สำหรับ critical side effects (same transaction)
 * Strategy แต่ละ document type ส่ง callbacks สำหรับ critical effects ที่ต้องทำใน transaction เดียวกัน
 */
export interface CriticalSideEffectsInput {
  publicId: string;
  documentType: string;
  userId: string;
  queryRunner: QueryRunner;
  /** Callback: terminate workflow instance ที่ active อยู่ (ถ้ามี) */
  terminateWorkflow?: (queryRunner: QueryRunner) => Promise<void>;
  /** Callback: force-close circulation ที่เกี่ยวข้อง (ถ้ามี) — return จำนวนที่ปิด */
  forceCloseCirculations?: (queryRunner: QueryRunner) => Promise<number>;
}

/**
 * Input สำหรับ non-critical side effects (post-commit, BullMQ retry)
 */
export interface NonCriticalSideEffectsInput {
  publicId: string;
  documentType: string;
  userId: string;
  auditId: string;
  /** projectPublicId สำหรับ vector delete (Qdrant filter) */
  projectPublicId?: string;
  /** attachment file paths ที่ต้องลบจาก storage */
  storageFilePaths?: string[];
}

/**
 * ผลลัพธ์ side effects (ยกเว้น failedSideEffects ซึ่งอยู่ใน ActionResult)
 */
export type SideEffectsOutcome = Pick<
  SideEffectsResult,
  | 'searchReindexed'
  | 'notificationsSent'
  | 'workflowTerminated'
  | 'circulationsClosed'
>;

/**
 * Service สำหรับจัดการ side effects ของ document actions
 * - Critical: ทำใน transaction เดียวกัน (workflow terminate, circulation force-close)
 * - Non-critical: post-commit + BullMQ retry (search re-index, notification, vector delete)
 *
 * หมายเหตุ: Service นี้อยู่ใน CommonModule (Global) — ไม่ inject module-specific services
 * เพื่อหลีกเลี่ยง circular dependency. Critical effects ส่งเป็น callbacks จาก strategy.
 */
@Injectable()
export class DocumentSideEffectsService {
  private readonly logger = new Logger(DocumentSideEffectsService.name);

  constructor(
    @Optional()
    @InjectQueue(DOCUMENT_SIDE_EFFECTS_QUEUE)
    private readonly sideEffectsQueue?: Queue
  ) {}

  /**
   * Execute critical side effects ภายใน transaction เดียวกัน
   * Strategy ส่ง callbacks สำหรับ workflow termination และ circulation force-close
   */
  async executeCritical(
    input: CriticalSideEffectsInput
  ): Promise<SideEffectsOutcome> {
    const outcome: SideEffectsOutcome = {
      searchReindexed: false,
      notificationsSent: 0,
      workflowTerminated: false,
      circulationsClosed: 0,
    };

    // Workflow termination (critical — must succeed or rollback)
    if (input.terminateWorkflow) {
      try {
        await input.terminateWorkflow(input.queryRunner);
        outcome.workflowTerminated = true;
        this.logger.log(
          `Workflow terminated for ${input.documentType}:${input.publicId}`
        );
      } catch (err) {
        this.logger.error(
          `Workflow termination failed for ${input.documentType}:${input.publicId}`,
          err
        );
        throw err; // Critical — rethrow to rollback transaction
      }
    }

    // Circulation force-close (critical — must succeed or rollback)
    if (input.forceCloseCirculations) {
      try {
        outcome.circulationsClosed = await input.forceCloseCirculations(
          input.queryRunner
        );
        this.logger.log(
          `Force-closed ${outcome.circulationsClosed} circulations for ${input.documentType}:${input.publicId}`
        );
      } catch (err) {
        this.logger.error(
          `Circulation force-close failed for ${input.documentType}:${input.publicId}`,
          err
        );
        throw err; // Critical — rethrow to rollback transaction
      }
    }

    return outcome;
  }

  /**
   * Execute non-critical side effects post-commit
   * Dispatch BullMQ jobs สำหรับ search re-index, notification, vector delete
   * แต่ละ job มี retry 3 ครั้ง (BullMQ default backoff)
   */
  async executeNonCritical(input: NonCriticalSideEffectsInput): Promise<void> {
    if (!this.sideEffectsQueue) {
      this.logger.warn(
        `Side-effects queue not available — skipping non-critical effects for ${input.documentType}:${input.publicId}`
      );
      return;
    }

    const jobs: Array<{ name: string; data: Record<string, unknown> }> = [];

    // Search re-index job
    jobs.push({
      name: SideEffectJobType.SEARCH_REINDEX,
      data: {
        documentType: input.documentType,
        publicId: input.publicId,
        auditId: input.auditId,
      },
    });

    // Notification job
    jobs.push({
      name: SideEffectJobType.NOTIFICATION,
      data: {
        documentType: input.documentType,
        publicId: input.publicId,
        userId: input.userId,
        auditId: input.auditId,
      },
    });

    // Vector delete job (ถ้ามี projectPublicId)
    if (input.projectPublicId) {
      jobs.push({
        name: SideEffectJobType.VECTOR_DELETE,
        data: {
          documentType: input.documentType,
          publicId: input.publicId,
          projectPublicId: input.projectPublicId,
          auditId: input.auditId,
        },
      });
    }

    // Dispatch all jobs — BullMQ จะ retry อัตโนมัติ (default: 3 attempts, exponential backoff)
    for (const job of jobs) {
      try {
        await this.sideEffectsQueue.add(job.name, job.data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      } catch (err) {
        this.logger.error(
          `Failed to enqueue ${job.name} for ${input.documentType}:${input.publicId}`,
          err
        );
        // Non-critical — log but don't throw
      }
    }

    this.logger.log(
      `Dispatched ${jobs.length} non-critical side-effect jobs for ${input.documentType}:${input.publicId}`
    );
  }
}
