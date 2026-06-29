import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SearchProjectDto } from './dto/search-project.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('projects') // แนะนำให้ใช้ plural noun (projects)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create new Project' })
  @RequirePermission('project.create')
  create(@Body() createDto: CreateProjectDto) {
    return this.projectService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search Projects' })
  @RequirePermission('project.view')
  findAll(@Query() searchDto: SearchProjectDto) {
    return this.projectService.findAll(searchDto);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List All Organizations (Master Data)' })
  // @RequirePermission('organization.view') // หรือเปิดให้ดูได้ทั่วไปถ้าจำเป็น
  findAllOrgs() {
    return this.projectService.findAllOrganizations();
  }

  @Get(':uuid/contracts')
  @ApiOperation({ summary: 'List All Contracts in Project' })
  @RequirePermission('project.view')
  findContracts(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.projectService.findContracts(uuid);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Project Details' })
  @RequirePermission('project.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.projectService.findOneByUuid(uuid);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update Project' })
  @RequirePermission('project.edit')
  update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() updateDto: UpdateProjectDto
  ) {
    return this.projectService.update(uuid, updateDto);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete Project (Soft Delete)' })
  @RequirePermission('project.delete')
  remove(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.projectService.remove(uuid);
  }
}
