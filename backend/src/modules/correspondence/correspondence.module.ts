import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrespondenceService } from './correspondence.service.js';
import { CorrespondenceController } from './correspondence.controller.js';
import { Correspondence } from './entities/correspondence.entity.js';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity.js';
import { CorrespondenceType } from './entities/correspondence-type.entity.js';
// Import Entities ใหม่
import { RoutingTemplate } from './entities/routing-template.entity.js';
import { RoutingTemplateStep } from './entities/routing-template-step.entity.js';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity.js';

import { CorrespondenceStatus } from './entities/correspondence-status.entity.js';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module.js'; // ต้องใช้ตอน Create
import { JsonSchemaModule } from '../json-schema/json-schema.module.js'; // ต้องใช้ Validate Details
import { UserModule } from '../user/user.module.js'; // <--- 1. Import UserModule
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module.js'; // <--- ✅ เพิ่มบรรทัดนี้ครับ

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Correspondence,
      CorrespondenceRevision,
      CorrespondenceType,
      CorrespondenceStatus,
      RoutingTemplate, // <--- ลงทะเบียน
      RoutingTemplateStep, // <--- ลงทะเบียน
      CorrespondenceRouting, // <--- ลงทะเบียน
    ]),
    DocumentNumberingModule, // Import เพื่อขอเลขที่เอกสาร
    JsonSchemaModule, // Import เพื่อ Validate JSON
    UserModule, // <--- 2. ใส่ UserModule ใน imports เพื่อให้ RbacGuard ทำงานได้
    WorkflowEngineModule, // <--- Import WorkflowEngine
  ],
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService],
  exports: [CorrespondenceService],
})
export class CorrespondenceModule {}
