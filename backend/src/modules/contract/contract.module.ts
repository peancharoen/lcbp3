import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { Contract } from './entities/contract.entity';
import { ContractOrganization } from './entities/contract-organization.entity';
import { ProjectModule } from '../project/project.module'; // Likely needed for Project entity or service

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractOrganization]),
    ProjectModule,
  ],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
