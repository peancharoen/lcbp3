// File: src/modules/workflow-engine/workflow-engine.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowDslService, CompiledWorkflow } from './workflow-dsl.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';

// Interface สำหรับ Backward Compatibility (Logic เดิม)
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
    private readonly dslService: WorkflowDslService,
  ) {}

  // =================================================================
  // [NEW] DSL & Workflow Engine (Phase 6A)
  // =================================================================

  /**
   * สร้างหรืออัปเดต Workflow Definition ใหม่ (Auto Versioning)
   */
  async createDefinition(
    dto: CreateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinition> {
    const compiled = this.dslService.compile(dto.dsl);

    const latest = await this.workflowDefRepo.findOne({
      where: { workflow_code: dto.workflow_code },
      order: { version: 'DESC' },
    });

    const nextVersion = latest ? latest.version + 1 : 1;

    const entity = this.workflowDefRepo.create({
      workflow_code: dto.workflow_code,
      version: nextVersion,
      dsl: dto.dsl,
      compiled: compiled,
      is_active: dto.is_active ?? true,
    });

    return this.workflowDefRepo.save(entity);
  }

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

  async evaluate(dto: EvaluateWorkflowDto): Promise<any> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: dto.workflow_code, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException(
        `No active workflow definition found for "${dto.workflow_code}"`,
      );
    }

    const compiled: CompiledWorkflow = definition.compiled;
    const result = this.dslService.evaluate(
      compiled,
      dto.current_state,
      dto.action,
      dto.context || {},
    );

    this.logger.log(
      `Workflow Evaluated: ${dto.workflow_code} [${dto.current_state}] --${dto.action}--> [${result.nextState}]`,
    );

    return result;
  }

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
  // [LEGACY] Backward Compatibility for Correspondence/RFA Modules
  // คืนค่า Logic เดิมเพื่อไม่ให้ Module อื่น Error (TS2339)
  // =================================================================

  /**
   * คำนวณสถานะถัดไปแบบ Linear Sequence (Logic เดิม)
   * ใช้สำหรับ CorrespondenceService และ RfaService ที่ยังไม่ได้ Refactor
   */
  processAction(
    currentSequence: number,
    totalSteps: number,
    action: string, // รับเป็น string เพื่อความยืดหยุ่น
    returnToSequence?: number,
  ): TransitionResult {
    // Map string action to enum logic
    switch (action) {
      case WorkflowAction.APPROVE:
      case WorkflowAction.ACKNOWLEDGE:
      case 'APPROVE': // Case sensitive handling fallback
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
        // กรณีส่ง Action อื่นมา ให้ถือว่าเป็น Approve (หรือจะ Throw Error ก็ได้)
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
