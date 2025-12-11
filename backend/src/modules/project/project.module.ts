import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';

import { Project } from './entities/project.entity';
import { ProjectOrganization } from './entities/project-organization.entity';
// Modules
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectOrganization]),
    UserModule,
    OrganizationModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
