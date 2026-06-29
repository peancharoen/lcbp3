// File: src/modules/dashboard/dashboard.module.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Dashboard Module

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { WorkflowInstance } from '../workflow-engine/entities/workflow-instance.entity';
import { Project } from '../project/entities/project.entity';
import { UserAssignment } from '../user/entities/user-assignment.entity';

// Controller & Service
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Correspondence,
      AuditLog,
      WorkflowInstance,
      Project,
      UserAssignment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
