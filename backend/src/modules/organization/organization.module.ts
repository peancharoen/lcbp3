import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationRole } from './entities/organization-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationRole])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
