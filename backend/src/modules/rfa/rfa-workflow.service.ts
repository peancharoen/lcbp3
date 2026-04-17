// File: src/modules/rfa/rfa-workflow.service.ts
//
// NOTE (Phase 4.1 Refactor):
// This service was written as an alternative workflow integration layer using the
// Unified WorkflowEngineService (ADR-001). It is currently NOT called by RfaController.
// Active workflow logic lives in RfaService.submit() / RfaService.processAction().
//
// Reserved for Phase 3: When the Unified Workflow Engine is fully wired to RFA,
// RfaService workflow methods should be migrated here and RfaController updated
// to delegate to RfaWorkflowService.
//

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Modules
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

// Entities
import { RfaApproveCode } from './entities/rfa-approve-code.entity';
import { RfaRevision } from './entities/rfa-revision.entity';
import { RfaStatusCode } from './entities/rfa-status-code.entity';
import { Rfa } from './entities/rfa.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';

// DTOs
import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';

@Injectable()
export class RfaWorkflowService {
  private readonly logger = new Logger(RfaWorkflowService.name);
  private readonly WORKFLOW_CODE = 'RFA_APPROVAL'; // [C2] All RFA types share one workflow

  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    @InjectRepository(Rfa)
    private readonly rfaRepo: Repository<Rfa>,
    @InjectRepository(RfaRevision)
    private readonly revisionRepo: Repository<RfaRevision>,
    @InjectRepository(CorrespondenceRevision)
    private readonly corrRevisionRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(RfaStatusCode)
    private readonly statusRepo: Repository<RfaStatusCode>,
    @InjectRepository(RfaApproveCode)
    private readonly approveCodeRepo: Repository<RfaApproveCode>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * เริ่มต้น Workflow สำหรับเอกสาร RFA (เมื่อกด Submit)
   */
  async submitWorkflow(rfaId: number, userId: number, note?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. ดึงข้อมูล Revision ปัจจุบัน
      const corrRevision = await this.corrRevisionRepo.findOne({
        where: { correspondenceId: rfaId, isCurrent: true },
        relations: [
          'rfaRevision',
          'correspondence',
          'correspondence.discipline',
        ],
      });

      if (!corrRevision || !corrRevision.rfaRevision) {
        throw new NotFoundException(
          `Current Revision for RFA ID ${rfaId} not found`
        );
      }

      // 2. สร้าง Context (ข้อมูลประกอบการตัดสินใจ)
      const context = {
        rfaType: corrRevision.correspondence?.correspondenceTypeId,
        discipline: corrRevision.correspondence?.discipline,
        ownerId: userId,
        // อาจเพิ่มเงื่อนไขอื่นๆ เช่น จำนวนวัน, ความเร่งด่วน
      };

      // 3. สร้าง Workflow Instance
      // Entity Type = 'rfa_revision'
      const instance = await this.workflowEngine.createInstance(
        this.WORKFLOW_CODE,
        'rfa_revision',
        corrRevision.id.toString(),
        context
      );

      // 4. Auto Transition: SUBMIT
      const transitionResult = await this.workflowEngine.processTransition(
        instance.id,
        'SUBMIT',
        userId,
        note || 'RFA Submitted',
        {}
      );

      // 5. Sync สถานะกลับตาราง RFA Revision
      await this.syncStatus(
        corrRevision.rfaRevision,
        transitionResult.nextState,
        undefined,
        queryRunner
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Started workflow for RFA #${rfaId} (Instance: ${instance.id})`
      );

      return {
        instanceId: instance.id,
        currentState: transitionResult.nextState,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to submit RFA workflow: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ดำเนินการอนุมัติ/ตรวจสอบ RFA
   */
  async processAction(
    instanceId: string,
    userId: number,
    dto: WorkflowTransitionDto
  ) {
    // 1. ส่งคำสั่งให้ Engine ประมวลผล
    const result = await this.workflowEngine.processTransition(
      instanceId,
      dto.action,
      userId,
      dto.comment,
      dto.payload
    );

    // 2. Sync สถานะกลับตารางเดิม
    const instance = await this.workflowEngine.getInstanceById(instanceId);
    if (instance && instance.entityType === 'rfa_revision') {
      const rfaRev = await this.revisionRepo.findOne({
        where: { id: Number(instance.entityId) },
      });
      if (rfaRev) {
        // เช็คว่า Action นี้มีการระบุ Approve Code มาใน Payload หรือไม่ (เช่น '1A', '3R')
        const approveCodeStr = dto.payload?.approveCode as string | undefined;
        await this.syncStatus(rfaRev, result.nextState, approveCodeStr);
      }
    }

    return result;
  }

  /**
   * Helper: Map Workflow State -> RFA Status & Approve Code
   */
  private async syncStatus(
    revision: RfaRevision,
    workflowState: string,
    approveCodeStr?: string, // เช่น '1A', '1C'
    queryRunner?: import('typeorm').QueryRunner
  ) {
    // 1. Map Workflow State -> RFA Status Code (DFT, FAP, FCO...)
    const statusMap: Record<string, string> = {
      DRAFT: 'DFT',
      IN_REVIEW_CSC: 'FRE', // For Review (CSC)
      IN_REVIEW_OWNER: 'FAP', // For Approve (Owner)
      APPROVED: 'FCO', // For Construction (ตัวอย่าง)
      REJECTED: 'CC', // Canceled/Rejected
      REVISE: 'DFT', // กลับไปแก้ (Draft)
    };

    const targetStatusCode = statusMap[workflowState] || 'DFT';
    const status = await this.statusRepo.findOne({
      where: { statusCode: targetStatusCode },
    });

    if (status) {
      revision.rfaStatusCodeId = status.id;
    }

    // 2. Map Approve Code (ถ้ามี)
    if (approveCodeStr) {
      const approveCode = await this.approveCodeRepo.findOne({
        where: { approveCode: approveCodeStr },
      });
      if (approveCode) {
        revision.rfaApproveCodeId = approveCode.id;
        revision.approvedDate = new Date(); // บันทึกวันที่อนุมัติ
      }
    }

    // 3. Save
    const manager = queryRunner
      ? queryRunner.manager
      : this.revisionRepo.manager;
    await manager.save(revision);

    this.logger.log(
      `Synced RFA Status Revision ${revision.id}: State=${workflowState} -> Status=${targetStatusCode}, AppCode=${approveCodeStr}`
    );
  }
}
