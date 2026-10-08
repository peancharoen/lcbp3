import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { DepartmentService } from './department.service';
import { UserGroupService } from './user-group.service';
import { UserGroupController } from './user-group.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationRole } from './entities/organization-role.entity';
import { Department } from './entities/department.entity';
import { UserGroup } from './entities/user-group.entity';
import { UserGroupMember } from './entities/user-group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationRole,
      Department,
      UserGroup,
      UserGroupMember,
    ]),
  ],
  controllers: [OrganizationController, UserGroupController],
  providers: [OrganizationService, DepartmentService, UserGroupService],
  exports: [OrganizationService, DepartmentService, UserGroupService],
})
export class OrganizationModule {}
