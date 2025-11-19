import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { Organization } from './entities/organization.entity.js';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  // ดึงรายการ Project ทั้งหมด
  async findAllProjects() {
    return this.projectRepository.find();
  }

  // ดึงรายการ Organization ทั้งหมด
  async findAllOrganizations() {
    return this.organizationRepository.find();
  }
}
