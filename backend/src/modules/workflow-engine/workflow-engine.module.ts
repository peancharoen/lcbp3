// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { WorkflowEventService } from './workflow-event.service'; // [NEW]

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
    UserModule,
  ],
  controllers: [WorkflowEngineController],
  providers: [
    WorkflowEngineService,
    WorkflowDslService,
    WorkflowEventService,
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
  ],
  exports: [WorkflowEngineService], // Export Service ให้ Module อื่น (Correspondence, RFA) เรียกใช้
})
export class WorkflowEngineModule {}
