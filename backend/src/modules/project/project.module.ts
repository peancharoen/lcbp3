import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';
import { Project } from './entities/project.entity.js';
import { Organization } from './entities/organization.entity.js';
import { Contract } from './entities/contract.entity.js';
import { ProjectOrganization } from './entities/project-organization.entity.js'; // เพิ่ม
import { ContractOrganization } from './entities/contract-organization.entity.js'; // เพิ่ม

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Organization,
      Contract,
      ProjectOrganization, // ลงทะเบียน
      ContractOrganization, // ลงทะเบียน
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService], // Export เผื่อ Module อื่นใช้
})
export class ProjectModule {}
