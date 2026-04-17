// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  ],
  exports: [WorkflowEngineService], // Export Service ให้ Module อื่น (Correspondence, RFA) เรียกใช้
})
export class WorkflowEngineModule {}
