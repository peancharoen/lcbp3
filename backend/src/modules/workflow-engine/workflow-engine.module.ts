// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowHistory } from './entities/workflow-history.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';

// Services
import { WorkflowDslService } from './workflow-dsl.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEventService } from './workflow-event.service'; // [NEW]

// Controllers
import { UserModule } from '../user/user.module';
import { WorkflowEngineController } from './workflow-engine.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
    ]),
    UserModule,
  ],
  controllers: [WorkflowEngineController],
  providers: [WorkflowEngineService, WorkflowDslService, WorkflowEventService],
  exports: [WorkflowEngineService], // Export Service ให้ Module อื่น (Correspondence, RFA) เรียกใช้
})
export class WorkflowEngineModule {}
