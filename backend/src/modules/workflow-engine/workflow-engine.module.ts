// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

// Entities
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';

// Services
import { WorkflowDslService } from './workflow-dsl.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEventService } from './workflow-event.service';
import { WorkflowEventProcessor } from './workflow-event.processor';

// Guards
import { WorkflowTransitionGuard } from './guards/workflow-transition.guard';

// Controllers
import { UserModule } from '../user/user.module';
import { WorkflowEngineController } from './workflow-engine.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
      Attachment, // ADR-021: ใช้ link attachments ประจำ Step
    ]),
    // FR-005/006: BullMQ queues สำหรับ workflow events + Dead-Letter Queue
    BullModule.registerQueue({ name: 'workflow-events' }),
    BullModule.registerQueue({ name: 'workflow-events-failed' }),
    UserModule,
  ],
  controllers: [WorkflowEngineController],
  providers: [
    WorkflowEngineService,
    WorkflowDslService,
    WorkflowEventService,
    WorkflowEventProcessor, // FR-005: BullMQ Processor + DLQ handler
    WorkflowTransitionGuard,
    // ADR-021 S1: Redlock observability — Prometheus metrics
    makeHistogramProvider({
      name: 'workflow_redlock_acquire_duration_ms',
      help: 'เวลาที่ใช้ในการ acquire Redlock สำหรับ workflow transition (รวม retry)',
      labelNames: ['outcome'], // 'success' | 'failure'
      buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
    }),
    makeCounterProvider({
      name: 'workflow_redlock_acquire_failures_total',
      help: 'จำนวนครั้งที่ Redlock acquire ล้มเหลวหลัง retry ครบ (Fail-closed HTTP 503)',
    }),
    // FR-023: Per-transition metrics — labelled by workflow_code, action, outcome
    makeCounterProvider({
      name: 'workflow_transitions_total',
      help: 'จำนวน workflow transitions ทั้งหมด จำแนกตาม workflow_code, action และ outcome',
      labelNames: ['workflow_code', 'action', 'outcome'],
    }),
    makeHistogramProvider({
      name: 'workflow_transition_duration_ms',
      help: 'เวลาที่ใช้ในการ process workflow transition ทั้งหมด (ms) รวม Redlock + DB transaction',
      labelNames: ['workflow_code'],
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
    }),
  ],
  exports: [WorkflowEngineService], // Export Service ให้ Module อื่น (Correspondence, RFA) เรียกใช้
})
export class WorkflowEngineModule {}
