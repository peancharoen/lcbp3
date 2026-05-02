// File: src/modules/workflow-engine/workflow-engine.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
// ADR-007: ใช้ custom exceptions ที่ extends BaseException เพื่อให้ payload ตรง layered structure
import {
  NotFoundException,
  WorkflowException,
  ConflictException,
  ServiceUnavailableException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
// ADR-021 Clarify Q2: Redis Redlock for transition Fail-closed (Retry 3x → 503)
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
// Entities
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
} from './entities/workflow-instance.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';

// Services & Interfaces
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowHistoryItemDto } from './dto/workflow-history-item.dto';
import {
  CompiledWorkflow,
  RawWorkflowDSL,
  WorkflowDslService,
} from './workflow-dsl.service';
import { WorkflowEventService } from './workflow-event.service'; // [NEW] Import Event Service

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
  private readonly redlock: Redlock;

  // ADR-021 Clarify Q1: สถานะ workflow ที่อนุญาตให้อัปโหลด Step-attachment
  private static readonly UPLOAD_ALLOWED_STATES = new Set<string>([
    'PENDING_REVIEW',
    'PENDING_APPROVAL',
  ]);

  constructor(
    @InjectRepository(WorkflowDefinition)
    private readonly workflowDefRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowHistory)
    private readonly historyRepo: Repository<WorkflowHistory>,
    // ADR-021: Repository สำหรับ Link Attachments ประจำ Step
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    private readonly dslService: WorkflowDslService,
    private readonly eventService: WorkflowEventService, // [NEW] Inject Service
    private readonly dataSource: DataSource, // ใช้สำหรับ Transaction
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache, // ADR-021 T024: History cache
    @InjectRedis() private readonly redis: Redis, // ADR-021 Clarify Q2: Redlock
    // ADR-021 S1: Redlock observability metrics
    @InjectMetric('workflow_redlock_acquire_duration_ms')
    private readonly redlockAcquireDuration: Histogram<string>,
    @InjectMetric('workflow_redlock_acquire_failures_total')
    private readonly redlockAcquireFailures: Counter<string>,
    // FR-023: Per-transition metrics — labelled by workflow_code, action, outcome
    @InjectMetric('workflow_transitions_total')
    private readonly transitionsTotal: Counter<string>,
    @InjectMetric('workflow_transition_duration_ms')
    private readonly transitionDuration: Histogram<string>
  ) {
    // ADR-021 Clarify Q2 (C1): Redlock Fail-closed
    // Retry 3 ครั้ง × 500ms เพิ่ม jitter → ถ้ายังไม่ได้ throw HTTP 503
    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 500,
      retryJitter: 100,
    });
  }

  // =================================================================
  // [PART 1] Definition Management (Phase 6A)
  // =================================================================

  /**
   * FR-025: ตรวจสอบ DSL โดยไม่บันทึก — ใช้สำหรับ inline validation ใน Admin Editor
   */
  validateDsl(
    dsl: Record<string, unknown>
  ):
    | { valid: true }
    | { valid: false; errors: { path: string; message: string }[] } {
    try {
      this.dslService.compile(dsl as unknown as RawWorkflowDSL);
      return { valid: true };
    } catch (error: unknown) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  /**
   * สร้างหรืออัปเดต Workflow Definition ใหม่ (Auto Versioning)
   */
  async createDefinition(
    dto: CreateWorkflowDefinitionDto
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
      dsl: dto.dsl as unknown as Record<string, unknown>,
      compiled: compiled as unknown as Record<string, unknown>,
      is_active: dto.is_active ?? true,
    });

    const saved = await this.workflowDefRepo.save(entity);
    // T044: Cache definition per version (TTL 1h, SC-005)
    await this.cacheManager.set(
      `wf:def:${saved.workflow_code}:${saved.version}`,
      saved,
      3_600_000
    );
    this.logger.log(
      `Created Workflow Definition: ${saved.workflow_code} v${saved.version}`
    );
    return saved;
  }

  /**
   * อัปเดต Definition (Re-compile DSL)
   */
  async update(
    id: string,
    dto: UpdateWorkflowDefinitionDto
  ): Promise<WorkflowDefinition> {
    const definition = await this.workflowDefRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException('Workflow Definition', id);
    }

    if (dto.dsl) {
      try {
        const compiled = this.dslService.compile(dto.dsl);
        definition.dsl = dto.dsl as unknown as Record<string, unknown>;
        definition.compiled = compiled as unknown as Record<string, unknown>;
      } catch (error: unknown) {
        throw new WorkflowException(
          'INVALID_WORKFLOW_DSL',
          `Invalid DSL: ${error instanceof Error ? error.message : String(error)}`,
          'Workflow DSL ไม่ถูกต้อง กรุณาตรวจสอบโครงสร้าง',
          ['ตรวจสอบ syntax ของ DSL', 'ดูตัวอย่าง DSL ที่ถูกต้อง']
        );
      }
    }

    const prevIsActive = definition.is_active;
    if (dto.is_active !== undefined) definition.is_active = dto.is_active;
    if (dto.workflow_code) definition.workflow_code = dto.workflow_code;

    const updated = await this.workflowDefRepo.save(definition);

    // T045: Invalidate version cache เมื่อ DSL เปลี่ยน
    if (dto.dsl) {
      await this.cacheManager.del(
        `wf:def:${updated.workflow_code}:${updated.version}`
      );
    }
    // T045: Invalidate active pointer เมื่อ is_active เปลี่ยน
    if (dto.is_active !== undefined && dto.is_active !== prevIsActive) {
      await this.cacheManager.del(`wf:def:${updated.workflow_code}:active`);
    }
    // T045: Re-cache updated definition
    await this.cacheManager.set(
      `wf:def:${updated.workflow_code}:${updated.version}`,
      updated,
      3_600_000
    );

    return updated;
  }

  /**
   * ดึง Workflow Definition ทั้งหมด (เฉพาะ Version ล่าสุดของแต่ละ Workflow Code)
   */
  async getDefinitions(): Promise<WorkflowDefinition[]> {
    // หา version ล่าสุดของแต่ละ workflow_code
    // ใช้ query builder เพื่อ group by และหา max version
    const latestDefinitions = await this.workflowDefRepo
      .createQueryBuilder('def')
      .where(
        'def.version = (SELECT MAX(sub.version) FROM workflow_definitions sub WHERE sub.workflow_code = def.workflow_code)'
      )
      .getMany();

    return latestDefinitions;
  }

  /**
   * ดึง Workflow Definition ตาม ID หรือ Code
   */
  async getDefinitionById(id: string): Promise<WorkflowDefinition> {
    // T046: Read-through cache (TTL 1h, SC-005)
    const cacheKey = `wf:def:id:${id}`;
    const cached = await this.cacheManager.get<WorkflowDefinition>(cacheKey);
    if (cached) return cached;

    const definition = await this.workflowDefRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException('Workflow Definition', id);
    }

    await this.cacheManager.set(cacheKey, definition, 3_600_000);
    return definition;
  }

  /**
   * ดึง Action ที่ทำได้ ณ State ปัจจุบัน
   */
  async getAvailableActions(
    workflowCode: string,
    currentState: string
  ): Promise<string[]> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: workflowCode, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) return [];

    const compiled = definition.compiled as unknown as CompiledWorkflow;
    const stateConfig = compiled.states[currentState];
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
    initialContext: Record<string, unknown> = {}
  ): Promise<WorkflowInstance> {
    // 1. หา Definition ล่าสุด
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: workflowCode, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException('Workflow', workflowCode);
    }

    // 2. หา Initial State จาก Compiled Structure
    const compiled = definition.compiled as unknown as CompiledWorkflow;
    // [FIX] ใช้ initialState จาก Root Property โดยตรง (ตามที่ Optimize ใน DSL Service)
    // เพราะ CompiledState ใน states map ไม่มี property 'initial' แล้ว
    const initialState = compiled.initialState;

    if (!initialState) {
      throw new WorkflowException(
        'WORKFLOW_NO_INITIAL_STATE',
        `Workflow "${workflowCode}" has no initial state defined`,
        'Workflow ไม่มี Initial State ที่กำหนด',
        ['ตรวจสอบ DSL ของ Workflow นี้']
      );
    }

    // 3. สร้าง Instance
    // [C3] Extract contractId from context to persist as searchable column
    const contractId =
      typeof initialContext.contractId === 'number'
        ? initialContext.contractId
        : null;
    const instance = this.instanceRepo.create({
      definition,
      entityType,
      entityId,
      currentState: initialState,
      status: WorkflowStatus.ACTIVE,
      contractId,
      context: initialContext,
    });

    const savedInstance = await this.instanceRepo.save(instance);
    this.logger.log(
      `Started Workflow Instance: ${workflowCode} for ${entityType}:${entityId}`
    );
    return savedInstance;
  }

  /**
   * ดึงข้อมูล Workflow Instance ตาม ID
   * ใช้สำหรับการตรวจสอบสถานะหรือซิงค์ข้อมูลกลับไปยัง Module หลัก
   */
  async getInstanceById(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: ['definition'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow Instance', instanceId);
    }

    return instance;
  }

  /**
   * ค้นหา Workflow Instance จาก entityType + entityId (ADR-021 / v1.8.7)
   * ใช้โดย TransmittalService และ CirculationService เพื่อ expose workflowInstanceId ใน response
   * คืนค่า null ถ้าไม่มี Instance (เช่น เอกสาร Draft ที่ยังไม่เริ่ม Workflow)
   */
  async getInstanceByEntity(
    entityType: string,
    entityId: string
  ): Promise<{
    id: string;
    currentState: string;
    availableActions: string[];
  } | null> {
    const instance = await this.instanceRepo.findOne({
      where: { entityType, entityId, status: WorkflowStatus.ACTIVE },
      relations: ['definition'],
      order: { createdAt: 'DESC' },
    });

    if (!instance) return null;

    const compiled = instance.definition?.compiled as unknown as
      | CompiledWorkflow
      | undefined;
    const stateConfig = compiled?.states?.[instance.currentState];
    const availableActions = stateConfig?.transitions
      ? Object.keys(stateConfig.transitions)
      : [];

    return {
      id: instance.id, // publicId (UUID) ของ workflow instance
      currentState: instance.currentState,
      availableActions,
    };
  }

  /**
   * ดำเนินการเปลี่ยนสถานะ (Transition) ของ Instance จริงแบบ Transactional
   */
  async processTransition(
    instanceId: string,
    action: string,
    userId: number,
    comment?: string,
    payload: Record<string, unknown> = {},
    // ADR-021: publicIds ของไฟล์แนบประจำ Step นี้ (Two-Phase upload ก่อนแล้ว)
    attachmentPublicIds?: string[],
    // ADR-019: UUID ของ User สำหรับ history record (ไม่ expose INT PK)
    userUuid?: string,
    // ADR-001 v1.1 FR-002: Optimistic lock — Client ส่งมาเพื่อป้องกัน Double-approval
    clientVersionNo?: number
  ) {
    // FR-022/023: เริ่มจับเวลาทั้ง method เพื่อบันทึก latency metric
    const startMs = Date.now();
    let outcome:
      | 'success'
      | 'conflict'
      | 'forbidden'
      | 'validation_error'
      | 'system_error' = 'system_error';
    let workflowCode = 'unknown';
    let fromState: string | undefined;
    let toState: string | undefined;
    const hasAttachments =
      attachmentPublicIds !== undefined && attachmentPublicIds.length > 0;

    // ==============================================================
    // ADR-001 v1.1 FR-002: Fast-fail Optimistic Lock Check (ก่อน Redlock)
    // ลดภาระ Redlock สำหรับ Client ที่ส่ง version_no ล้าสมัยมา
    // ==============================================================
    if (clientVersionNo !== undefined) {
      const current = await this.instanceRepo.findOne({
        where: { id: instanceId },
        select: ['id', 'versionNo'],
      });
      if (!current) {
        throw new NotFoundException('Workflow Instance', instanceId);
      }
      if (current.versionNo !== clientVersionNo) {
        outcome = 'conflict';
        throw new ConflictException(
          'WORKFLOW_VERSION_CONFLICT',
          `Fast-fail: expected version_no=${clientVersionNo}, actual=${current.versionNo}`,
          'เอกสารถูกอนุมัติโดยผู้อื่นแล้ว กรุณารีเฟรชและลองใหม่',
          ['รีเฟรชหน้าแล้วดูสถานะล่าสุดก่อนดำเนินการ']
        );
      }
    }

    // ==============================================================
    // ADR-021 Clarify Q1 (C3): ตรวจสถานะก่อน acquire Redlock
    // อนุญาตให้แนบไฟล์เฉพาะในสถานะ PENDING_REVIEW / PENDING_APPROVAL
    // ==============================================================
    if (hasAttachments) {
      // ADR-021 S2: `id` ใน WorkflowInstance เป็น CHAR(36) UUID direct PK
      // (ไม่ใช่ pattern UuidBaseEntity ที่ INT+publicId) — ADR-019 compliant เพราะ UUID ถูก expose โดยตรง
      const instancePreCheck = await this.instanceRepo.findOne({
        where: { id: instanceId },
        select: ['id', 'currentState'],
      });
      if (!instancePreCheck) {
        throw new NotFoundException('Workflow Instance', instanceId);
      }
      if (
        !WorkflowEngineService.UPLOAD_ALLOWED_STATES.has(
          instancePreCheck.currentState
        )
      ) {
        throw new ConflictException(
          'WORKFLOW_STATE_LOCKED',
          `Upload rejected: currentState=${instancePreCheck.currentState} not in UPLOAD_ALLOWED_STATES`,
          'ไม่สามารถอัปโหลดไฟล์ในสถานะนี้ได้',
          [
            'อนุญาตเฉพาะสถานะ PENDING_REVIEW หรือ PENDING_APPROVAL เท่านั้น',
            'รีเฟรชหน้าแล้วตรวจสถานะล่าสุด',
          ]
        );
      }
    }

    // ==============================================================
    // ADR-021 Clarify Q2 (C1): Acquire Redlock (Fail-closed)
    // Retry 3x × 500ms + jitter → ถ้ายังไม่ได้ throw HTTP 503
    // ==============================================================
    const lockKey = `lock:wf:transition:${instanceId}`;
    let lock: Lock;
    const acquireStart = Date.now();
    try {
      lock = await this.redlock.acquire([lockKey], 10000); // 10s TTL
      // S1: บันทึก duration กรณี acquire สำเร็จ
      this.redlockAcquireDuration
        .labels({ outcome: 'success' })
        .observe(Date.now() - acquireStart);
    } catch (err) {
      // S1: บันทึก duration + failure counter
      this.redlockAcquireDuration
        .labels({ outcome: 'failure' })
        .observe(Date.now() - acquireStart);
      this.redlockAcquireFailures.inc();
      this.logger.error(
        `Redlock acquire failed after retries for ${instanceId}: ${(err as Error).message}`
      );
      throw new ServiceUnavailableException(
        'WORKFLOW_LOCK_UNAVAILABLE',
        `Redlock acquire failed after 3 retries on lock:wf:transition:${instanceId}`,
        'ระบบยุ่งชั่วคราว กรุณาลองใหม่ภายหลัง',
        ['รอสักครู่แล้วลองใหม่', 'แจ้งผู้ดูแลระบบหากยังพบปัญหา']
      );
    }

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
        throw new NotFoundException('Workflow Instance', instanceId);
      }

      if (instance.status !== WorkflowStatus.ACTIVE) {
        throw new WorkflowException(
          'WORKFLOW_NOT_ACTIVE',
          `Workflow is not active (Status: ${instance.status})`,
          'Workflow ไม่อยู่ในสถานะ Active',
          ['ตรวจสอบสถานะของ Workflow']
        );
      }

      // ==============================================================
      // ADR-021 (H1): Re-check state ภายใต้ pessimistic lock — ปิด TOCTOU race
      // pre-check ด้านหน้าเป็น optimistic fast-fail; เช็กที่นี่เป็น authoritative
      // ==============================================================
      if (
        hasAttachments &&
        !WorkflowEngineService.UPLOAD_ALLOWED_STATES.has(instance.currentState)
      ) {
        throw new ConflictException(
          'WORKFLOW_STATE_CHANGED',
          `TOCTOU: state changed to ${instance.currentState} under pessimistic lock`,
          'ไม่สามารถอัปโหลดไฟล์ได้ (สถานะเอกสารได้เปลี่ยนไปก่อนหน้านี้)',
          ['รีเฟรชหน้าแล้วตรวจสถานะล่าสุดของเอกสาร']
        );
      }

      // 2. Evaluate Logic ผ่าน DSL Service
      const compiled = instance.definition
        .compiled as unknown as CompiledWorkflow;
      const context = { ...instance.context, userId, ...payload }; // Merge Context

      // * DSL Service จะ throw error ถ้า action ไม่ถูกต้อง หรือสิทธิ์ไม่พอ
      const evaluation = this.dslService.evaluate(
        compiled,
        instance.currentState,
        action,
        context
      );

      fromState = instance.currentState;
      toState = evaluation.nextState;
      // FR-023: บันทึก workflowCode สำหรับ metric labels
      workflowCode = instance.definition?.workflow_code ?? 'unknown';

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
        // ADR-019 FR-003: UUID ของ User สำหรับ API Response (INT PK ไม่ expose)
        actionByUserUuid: userUuid,
        comment,
        metadata: {
          events: evaluation.events,
          payload,
        },
      });
      const savedHistory = await queryRunner.manager.save(history);

      // ==============================================================
      // ADR-021 (C2): Link attachments พร้อม guard 3 ชั้น
      //   1. isTemporary = false       — Two-Phase commit แล้ว (ADR-016)
      //   2. uploadedByUserId = userId — ownership check (กัน attach ไฟล์คนอื่น)
      //   3. workflowHistoryId IS NULL — ยังไม่เคยผูกกับ step อื่น
      // ==============================================================
      if (hasAttachments) {
        const updateResult = await queryRunner.manager.update(
          Attachment,
          {
            publicId: In(attachmentPublicIds),
            isTemporary: false,
            uploadedByUserId: userId,
            workflowHistoryId: null,
          },
          { workflowHistoryId: savedHistory.id }
        );

        const expected = attachmentPublicIds.length;
        const actual = updateResult.affected ?? 0;
        if (actual !== expected) {
          throw new WorkflowException(
            'INVALID_ATTACHMENTS',
            `Attachment link mismatch: expected ${expected}, linked ${actual}`,
            'ไฟล์แนบบางไฟล์ไม่สามารถผูกกับขั้นตอนนี้ได้',
            [
              'ตรวจสอบว่าไฟล์อัปโหลดสำเร็จ (ไม่ใช่ temp)',
              'ตรวจสอบว่าคุณเป็นเจ้าของไฟล์ทุกไฟล์',
              'ตรวจสอบว่าไฟล์ยังไม่เคยถูกผูกกับ step อื่น',
            ]
          );
        }
      }

      // ADR-001 v1.1 FR-002: CAS version increment หลัง commit ใน DB transaction
      // UPDATE จะล้มเหลว (affected=0) ถ้า version_no ถูกเปลี่ยนระหว่างนี้ (TOCTOU edge case)
      const casResult = await queryRunner.manager
        .createQueryBuilder()
        .update(WorkflowInstance)
        .set({ versionNo: () => 'version_no + 1' })
        .where('id = :id AND version_no = :expected', {
          id: instanceId,
          expected: instance.versionNo,
        })
        .execute();

      if ((casResult.affected ?? 0) === 0) {
        throw new ConflictException(
          'WORKFLOW_VERSION_CONFLICT',
          'version_no changed between Redlock acquisition and CAS update (TOCTOU edge case)',
          'เกิด Conflict กรุณารีเฟรชและลองใหม่',
          ['รีเฟรชหน้า', 'ลองดำเนินการอีกครั้ง']
        );
      }

      await queryRunner.commitTransaction();

      // ADR-021 T043: Invalidate Workflow History cache หลัง transition สำเร็จ
      this.cacheManager
        .del(`wf:history:${instanceId}`)
        .catch((e: unknown) =>
          this.logger.warn(
            `Cache invalidation failed for wf:history:${instanceId} — stale data may be served. Error: ${e instanceof Error ? e.message : String(e)}`
          )
        );

      this.logger.log(
        `Transition: ${instanceId} [${fromState}] --${action}--> [${toState}] by User:${userId}`
      );

      // Dispatch Events (Async, Fire-and-forget) ผ่าน WorkflowEventService
      if (evaluation.events.length > 0) {
        void this.eventService.dispatchEvents(
          instance.id,
          evaluation.events,
          context,
          workflowCode // FR-005: DLQ notification \u0e43\u0e0a\u0e49 workflowCode \u0e23\u0e30\u0e1a\u0e38\u0e1a\u0e23\u0e34\u0e1a\u0e17\u0e18\u0e34\u0e4c Ops
        );
      }

      outcome = 'success';
      // FR-014 T014: คืน versionNo ที่ increment แล้ว ให้ Client เก็บไว้สำหรับ request ถัดไป
      const newVersionNo = instance.versionNo + 1;

      return {
        success: true,
        previousState: fromState,
        nextState: toState,
        events: evaluation.events,
        isCompleted: instance.status === WorkflowStatus.COMPLETED,
        versionNo: newVersionNo,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // FR-019: Rollback file attachments กลับเป็น temporary เมื่อ DB transaction ล้มเหลว
      // ไฟล์บน disk ยังคงอยู่ที่ permanent storage; cleanup job จะจัดการหลัง 24h TTL
      if (
        hasAttachments &&
        attachmentPublicIds &&
        attachmentPublicIds.length > 0
      ) {
        await this.attachmentRepo
          .update(
            { publicId: In(attachmentPublicIds), uploadedByUserId: userId },
            {
              isTemporary: true,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }
          )
          .catch((rollbackErr: unknown) =>
            this.logger.error(
              `FR-019 Attachment rollback failed for ${instanceId}: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`
            )
          );
        this.logger.warn(
          `FR-019: Reverted ${attachmentPublicIds.length} attachment(s) to temp for instance ${instanceId} after DB failure`
        );
      }

      // จำแนก outcome สำหรับ metric label
      if (err instanceof ConflictException) outcome = 'conflict';
      else if ((err as { status?: number }).status === 403)
        outcome = 'forbidden';
      else if (err instanceof WorkflowException) outcome = 'validation_error';

      this.logger.error(
        `Transition Failed for ${instanceId}: ${(err as Error).message}`
      );
      throw err;
    } finally {
      const durationMs = Date.now() - startMs;
      // FR-023: บันทึก transition duration histogram
      this.transitionDuration
        .labels({ workflow_code: workflowCode })
        .observe(durationMs);
      // FR-023: บันทึก transition counter ตาม outcome
      this.transitionsTotal
        .labels({ workflow_code: workflowCode, action, outcome })
        .inc();
      // FR-022: Structured log entry ทุก transition (success/failure/conflict)
      this.logger.log(
        JSON.stringify({
          instanceId,
          action,
          fromState,
          toState,
          userUuid,
          durationMs,
          outcome,
          workflowCode,
        })
      );

      await queryRunner.release();
      // ADR-021 C1: ปล่อย Redlock เสมอ (non-blocking หาก release ผิดพลาด)
      lock.release().catch((e: unknown) => {
        this.logger.warn(
          `Redlock release failed for ${instanceId} (may have expired): ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      });
    }
  }

  /**
   * (Utility) Evaluate แบบไม่บันทึกผล (Dry Run) สำหรับ Test หรือ Preview
   */
  async evaluate(dto: EvaluateWorkflowDto): Promise<unknown> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: dto.workflow_code, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException(`Workflow "${dto.workflow_code}" not found`);
    }

    return this.dslService.evaluate(
      definition.compiled as unknown as CompiledWorkflow,
      dto.current_state,
      dto.action,
      dto.context || {}
    );
  }

  // =================================================================
  // [PART 2.5] ADR-021: Workflow History with Step Attachments
  // =================================================================

  /**
   * ดึงประวัติ Workflow พร้อมไฟล์แนบประจำแต่ละ Step (2-query, ไม่มี N+1)
   * GET /instances/:id/history
   */
  async getHistoryWithAttachments(
    instanceId: string
  ): Promise<WorkflowHistoryItemDto[]> {
    // ADR-021 T024: Redis cache — ป้องกัน N+1 บน repeated view (TTL 1h)
    const cacheKey = `wf:history:${instanceId}`;
    const cached =
      await this.cacheManager.get<WorkflowHistoryItemDto[]>(cacheKey);
    if (cached) return cached;

    const histories = await this.historyRepo.find({
      where: { instanceId },
      order: { createdAt: 'ASC' },
    });

    if (histories.length === 0) return [];

    // Batch-load attachments ครั้งเดียวเพื่อป้องกัน N+1
    const historyIds = histories.map((h) => h.id);
    const attachments = await this.attachmentRepo.find({
      where: { workflowHistoryId: In(historyIds) },
      select: [
        'publicId',
        'originalFilename',
        'mimeType',
        'fileSize',
        'workflowHistoryId',
      ],
    });

    // Group attachments ตาม workflowHistoryId
    const attByHistoryId = attachments.reduce<Record<string, Attachment[]>>(
      (acc, att) => {
        const key = att.workflowHistoryId!;
        if (!acc[key]) acc[key] = [];
        acc[key].push(att);
        return acc;
      },
      {}
    );

    const result: WorkflowHistoryItemDto[] = histories.map((h) => ({
      id: h.id,
      fromState: h.fromState,
      toState: h.toState,
      action: h.action,
      actionByUserId: h.actionByUserId,
      comment: h.comment,
      metadata: h.metadata,
      attachments: (attByHistoryId[h.id] ?? []).map((att) => ({
        publicId: att.publicId,
        originalFilename: att.originalFilename,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
      })),
      createdAt: h.createdAt.toISOString(),
    }));

    // Cache result (TTL 1h = 3_600_000 ms)
    await this.cacheManager.set(cacheKey, result, 3_600_000);
    return result;
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
    returnToSequence?: number
  ): TransitionResult {
    const act = action.toUpperCase();
    switch (act) {
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

      case 'REJECT':
        return {
          nextStepSequence: null,
          shouldUpdateStatus: true,
          documentStatus: 'REJECTED',
        };

      case 'RETURN': {
        const targetStep = returnToSequence || currentSequence - 1;
        if (targetStep < 1) {
          throw new WorkflowException(
            'WORKFLOW_INVALID_RETURN_TARGET',
            'Cannot return beyond the first step',
            'ไม่สามารถส่งคืนไปเกินกว่าขั้นตอนแรกได้',
            ['ตรวจสอบลำดับขั้นตอนที่ต้องการส่งคืน']
          );
        }
        return {
          nextStepSequence: targetStep,
          shouldUpdateStatus: true,
          documentStatus: 'REVISE_REQUIRED',
        };
      }

      default:
        this.logger.warn(
          `Unknown legacy action: ${action}, treating as next step.`
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
