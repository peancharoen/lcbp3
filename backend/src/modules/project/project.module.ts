import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';
import { OrganizationService } from './organization.service.js';
import { OrganizationController } from './organization.controller.js';
import { ContractService } from './contract.service.js';
import { ContractController } from './contract.controller.js';

import { Project } from './entities/project.entity.js';
import { Organization } from './entities/organization.entity.js';
import { Contract } from './entities/contract.entity.js';
import { ProjectOrganization } from './entities/project-organization.entity.js';
import { ContractOrganization } from './entities/contract-organization.entity.js';
// Modules
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Organization,
      Contract,
      ProjectOrganization,
      ContractOrganization,
    ]),
    UserModule,
  ],
  controllers: [ProjectController, OrganizationController, ContractController],
  providers: [ProjectService, OrganizationService, ContractService],
  exports: [ProjectService, OrganizationService, ContractService],
})
export class ProjectModule {}
