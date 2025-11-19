import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  findAll() {
    return this.projectService.findAllProjects();
  }

  @Get('organizations')
  findAllOrgs() {
    return this.projectService.findAllOrganizations();
  }
}
