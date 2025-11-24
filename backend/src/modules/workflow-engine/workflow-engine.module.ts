// File: src/modules/workflow-engine/workflow-engine.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDslService } from './workflow-dsl.service'; // [New] ต้องสร้างไฟล์นี้ตามแผน Phase 6A
import { WorkflowEngineController } from './workflow-engine.controller'; // [New] ต้องสร้างไฟล์นี้ตามแผน Phase 6A
import { WorkflowDefinition } from './entities/workflow-definition.entity'; // [New] ต้องสร้างไฟล์นี้ตามแผน Phase 6A

@Module({
  imports: [
    // เชื่อมต่อกับตาราง workflow_definitions
    TypeOrmModule.forFeature([WorkflowDefinition]),
  ],
  controllers: [WorkflowEngineController], // เพิ่ม Controller สำหรับรับ API
  providers: [
    WorkflowEngineService, // Service หลัก
    WorkflowDslService, // [New] Service สำหรับ Compile/Validate DSL
  ],
  exports: [WorkflowEngineService], // Export ให้ module อื่นใช้เหมือนเดิม
})
export class WorkflowEngineModule {}
