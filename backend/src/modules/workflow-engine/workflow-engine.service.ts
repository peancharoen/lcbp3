// File: src/modules/workflow-engine/workflow-engine.service.ts

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Entities
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
} from './entities/workflow-instance.entity';

// Services & Interfaces
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { CompiledWorkflow, WorkflowDslService } from './workflow-dsl.service';

// Legacy Interface (Backward Compatibility)
export enum WorkflowAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
}

export interface TransitionResult {
  nextStepSequence: number | null;
  shouldUpdateStatus: boolean;
  documentStatus?: string;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(WorkflowDefinition)
    private readonly workflowDefRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowHistory)
    private readonly historyRepo: Repository<WorkflowHistory>,
    private readonly dslService: WorkflowDslService,
    private readonly dataSource: DataSource, // ใช้สำหรับ Transaction
  ) {}

  // =================================================================
  // [PART 1] Definition Management (Phase 6A)
  // =================================================================

  /**
   * สร้างหรืออัปเดต Workflow Definition ใหม่ (Auto Versioning)
   */
  async createDefinition(
    dto: CreateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinition> {
    // 1. Compile & Validate DSL
    const compiled = this.dslService.compile(dto.dsl);

    // 2. Check latest version
    const latest = await this.workflowDefRepo.findOne({
      where: { workflow_code: dto.workflow_code },
      order: { version: 'DESC' },
    });

    const nextVersion = latest ? latest.version + 1 : 1;

    // 3. Save new version
    const entity = this.workflowDefRepo.create({
      workflow_code: dto.workflow_code,
      version: nextVersion,
      dsl: dto.dsl,
      compiled: compiled,
      is_active: dto.is_active ?? true,
    });

    const saved = await this.workflowDefRepo.save(entity);
    this.logger.log(
      `Created Workflow Definition: ${saved.workflow_code} v${saved.version}`,
    );
    return saved;
  }

  /**
   * อัปเดต Definition (Re-compile DSL)
   */
  async update(
    id: string,
    dto: UpdateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinition> {
    const definition = await this.workflowDefRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException(
        `Workflow Definition with ID "${id}" not found`,
      );
    }

    if (dto.dsl) {
      try {
        const compiled = this.dslService.compile(dto.dsl);
        definition.dsl = dto.dsl;
        definition.compiled = compiled;
      } catch (error: any) {
        throw new BadRequestException(`Invalid DSL: ${error.message}`);
      }
    }

    if (dto.is_active !== undefined) definition.is_active = dto.is_active;
    if (dto.workflow_code) definition.workflow_code = dto.workflow_code;

    return this.workflowDefRepo.save(definition);
  }

  /**
   * ดึง Action ที่ทำได้ ณ State ปัจจุบัน
   */
  async getAvailableActions(
    workflowCode: string,
    currentState: string,
  ): Promise<string[]> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: workflowCode, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) return [];

    const stateConfig = definition.compiled.states[currentState];
    if (!stateConfig || !stateConfig.transitions) return [];

    return Object.keys(stateConfig.transitions);
  }

  // =================================================================
  // [PART 2] Runtime Engine (Phase 3.1)
  // =================================================================

  /**
   * เริ่มต้น Workflow Instance ใหม่สำหรับเอกสาร
   */
  async createInstance(
    workflowCode: string,
    entityType: string,
    entityId: string,
    initialContext: Record<string, any> = {},
  ): Promise<WorkflowInstance> {
    // 1. หา Definition ล่าสุด
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: workflowCode, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException(
        `Workflow "${workflowCode}" not found or inactive.`,
      );
    }

    // 2. หา Initial State จาก Compiled Structure
    const compiled: CompiledWorkflow = definition.compiled;
    const initialState = Object.keys(compiled.states).find(
      (key) => compiled.states[key].initial,
    );

    if (!initialState) {
      throw new BadRequestException(
        `Workflow "${workflowCode}" has no initial state defined.`,
      );
    }

    // 3. สร้าง Instance
    const instance = this.instanceRepo.create({
      definition,
      entityType,
      entityId,
      currentState: initialState,
      status: WorkflowStatus.ACTIVE,
      context: initialContext,
    });

    const savedInstance = await this.instanceRepo.save(instance);
    this.logger.log(
      `Started Workflow Instance: ${workflowCode} for ${entityType}:${entityId}`,
    );
    return savedInstance;
  }

  /**
   * ดำเนินการเปลี่ยนสถานะ (Transition) ของ Instance จริงแบบ Transactional
   */
  async processTransition(
    instanceId: string,
    action: string,
    userId: number,
    comment?: string,
    payload: Record<string, any> = {},
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock Instance เพื่อป้องกัน Race Condition (Pessimistic Write Lock)
      const instance = await queryRunner.manager.findOne(WorkflowInstance, {
        where: { id: instanceId },
        relations: ['definition'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!instance) {
        throw new NotFoundException(
          `Workflow Instance "${instanceId}" not found.`,
        );
      }

      if (instance.status !== WorkflowStatus.ACTIVE) {
        throw new BadRequestException(
          `Workflow is not active (Status: ${instance.status}).`,
        );
      }

      // 2. Evaluate Logic ผ่าน DSL Service
      const compiled: CompiledWorkflow = instance.definition.compiled;
      const context = { ...instance.context, userId, ...payload }; // Merge Context

      // * DSL Service จะ throw error ถ้า action ไม่ถูกต้อง หรือสิทธิ์ไม่พอ
      const evaluation = this.dslService.evaluate(
        compiled,
        instance.currentState,
        action,
        context,
      );

      const fromState = instance.currentState;
      const toState = evaluation.nextState;

      // 3. อัปเดต Instance
      instance.currentState = toState;
      instance.context = context; // อัปเดต Context ด้วย

      // เช็คว่าเป็น Terminal State หรือไม่?
      if (compiled.states[toState].terminal) {
        instance.status = WorkflowStatus.COMPLETED;
      }

      await queryRunner.manager.save(instance);

      // 4. บันทึก History (Audit Trail)
      const history = this.historyRepo.create({
        instanceId: instance.id,
        fromState,
        toState,
        action,
        actionByUserId: userId,
        comment,
        metadata: {
          events: evaluation.events,
          payload,
        },
      });
      await queryRunner.manager.save(history);

      // 5. Trigger Events (Integration Point)
      // ในอนาคตสามารถ Inject NotificationService มาเรียกตรงนี้ได้
      if (evaluation.events && evaluation.events.length > 0) {
        this.logger.log(
          `Triggering ${evaluation.events.length} events for instance ${instanceId}`,
        );
        // await this.eventHandler.handle(evaluation.events);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Transition: ${instanceId} [${fromState}] --${action}--> [${toState}] by User:${userId}`,
      );

      return {
        success: true,
        nextState: toState,
        events: evaluation.events,
        isCompleted: instance.status === WorkflowStatus.COMPLETED,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Transition Failed for ${instanceId}: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * (Utility) Evaluate แบบไม่บันทึกผล (Dry Run) สำหรับ Test หรือ Preview
   */
  async evaluate(dto: EvaluateWorkflowDto): Promise<any> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: dto.workflow_code, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException(`Workflow "${dto.workflow_code}" not found`);
    }

    return this.dslService.evaluate(
      definition.compiled,
      dto.current_state,
      dto.action,
      dto.context || {},
    );
  }

  // =================================================================
  // [PART 3] Legacy Support (Backward Compatibility)
  // รักษา Logic เดิมไว้เพื่อให้ Module อื่น (Correspondence/RFA) ทำงานต่อได้
  // =================================================================

  /**
   * คำนวณสถานะถัดไปแบบ Linear Sequence (Logic เดิม)
   * @deprecated แนะนำให้เปลี่ยนไปใช้ processTransition แทนเมื่อ Refactor เสร็จ
   */
  processAction(
    currentSequence: number,
    totalSteps: number,
    action: string,
    returnToSequence?: number,
  ): TransitionResult {
    switch (action) {
      case WorkflowAction.APPROVE:
      case WorkflowAction.ACKNOWLEDGE:
      case 'APPROVE':
      case 'ACKNOWLEDGE':
        if (currentSequence >= totalSteps) {
          return {
            nextStepSequence: null,
            shouldUpdateStatus: true,
            documentStatus: 'COMPLETED',
          };
        }
        return {
          nextStepSequence: currentSequence + 1,
          shouldUpdateStatus: false,
        };

      case WorkflowAction.REJECT:
      case 'REJECT':
        return {
          nextStepSequence: null,
          shouldUpdateStatus: true,
          documentStatus: 'REJECTED',
        };

      case WorkflowAction.RETURN:
      case 'RETURN':
        const targetStep = returnToSequence || currentSequence - 1;
        if (targetStep < 1) {
          throw new BadRequestException('Cannot return beyond the first step');
        }
        return {
          nextStepSequence: targetStep,
          shouldUpdateStatus: true,
          documentStatus: 'REVISE_REQUIRED',
        };

      default:
        this.logger.warn(
          `Unknown legacy action: ${action}, treating as next step.`,
        );
        if (currentSequence >= totalSteps) {
          return {
            nextStepSequence: null,
            shouldUpdateStatus: true,
            documentStatus: 'COMPLETED',
          };
        }
        return {
          nextStepSequence: currentSequence + 1,
          shouldUpdateStatus: false,
        };
    }
  }
}
