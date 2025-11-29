// File: src/modules/circulation/circulation-workflow.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Modules
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

// Entities
import { CirculationStatusCode } from './entities/circulation-status-code.entity';
import { Circulation } from './entities/circulation.entity';

// DTOs
import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';

@Injectable()
export class CirculationWorkflowService {
  private readonly logger = new Logger(CirculationWorkflowService.name);
  private readonly WORKFLOW_CODE = 'CIRCULATION_INTERNAL_V1';

  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    @InjectRepository(Circulation)
    private readonly circulationRepo: Repository<Circulation>,
    @InjectRepository(CirculationStatusCode)
    private readonly statusRepo: Repository<CirculationStatusCode>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * เริ่มต้นใบเวียน (Start Circulation)
   * ปกติจะเริ่มเมื่อสร้าง Circulation หรือเมื่อกดส่ง
   */
  async startCirculation(circulationId: number, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const circulation = await this.circulationRepo.findOne({
        where: { id: circulationId },
      });

      if (!circulation) {
        throw new NotFoundException(
          `Circulation ID ${circulationId} not found`,
        );
      }

      // Context อาจประกอบด้วย Department หรือ Priority
      const context = {
        organizationId: circulation.organization,
        creatorId: userId,
      };

      // Create Instance (Entity Type = 'circulation')
      const instance = await this.workflowEngine.createInstance(
        this.WORKFLOW_CODE,
        'circulation',
        circulation.id.toString(),
        context,
      );

      // Auto start (OPEN -> IN_REVIEW)
      const transitionResult = await this.workflowEngine.processTransition(
        instance.id,
        'START',
        userId,
        'Start Circulation Process',
        {},
      );

      // Sync Status
      await this.syncStatus(
        circulation,
        transitionResult.nextState,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      return {
        instanceId: instance.id,
        currentState: transitionResult.nextState,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to start circulation: ${error}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * รับทราบ/ดำเนินการในใบเวียน (Acknowledge / Action)
   */
  async processAction(
    instanceId: string,
    userId: number,
    dto: WorkflowTransitionDto,
  ) {
    // ส่งให้ Engine
    const result = await this.workflowEngine.processTransition(
      instanceId,
      dto.action,
      userId,
      dto.comment,
      dto.payload,
    );

    // Sync Status กลับ
    const instance = await this.workflowEngine.getInstanceById(instanceId);
    if (instance && instance.entityType === 'circulation') {
      const circulation = await this.circulationRepo.findOne({
        where: { id: parseInt(instance.entityId) },
      });
      if (circulation) {
        await this.syncStatus(circulation, result.nextState);
      }
    }

    return result;
  }

  /**
   * Helper: Map Workflow State -> Circulation Status (OPEN, IN_REVIEW, COMPLETED)
   */
  private async syncStatus(
    circulation: Circulation,
    workflowState: string,
    queryRunner?: any,
  ) {
    const statusMap: Record<string, string> = {
      DRAFT: 'OPEN',
      ROUTING: 'IN_REVIEW',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    };

    const targetCode = statusMap[workflowState] || 'IN_REVIEW';

    // เนื่องจาก circulation เก็บ status_code เป็น String ในตารางเลย (ตาม Schema v1.4.4)
    // หรืออาจเป็น Relation ID ขึ้นอยู่กับ Implementation จริง
    // สมมติว่าเป็น String Code ตาม Schema:

    circulation.statusCode = targetCode;

    // ถ้าจบแล้ว ให้ลงเวลาปิด
    if (targetCode === 'COMPLETED') {
      circulation.closedAt = new Date();
    }

    const manager = queryRunner
      ? queryRunner.manager
      : this.circulationRepo.manager;
    await manager.save(circulation);

    this.logger.log(
      `Synced Circulation #${circulation.id}: State=${workflowState} -> Status=${targetCode}`,
    );
  }
}
