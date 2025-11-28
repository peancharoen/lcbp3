// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowHistory } from './entities/workflow-history.entity'; // [New]
import { WorkflowInstance } from './entities/workflow-instance.entity'; // [New]
import { WorkflowDslService } from './workflow-dsl.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance, // [New]
      WorkflowHistory, // [New]
    ]),
  ],
  controllers: [WorkflowEngineController],
  providers: [WorkflowEngineService, WorkflowDslService],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
