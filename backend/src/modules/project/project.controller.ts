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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SearchProjectDto } from './dto/search-project.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
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

  @Get(':id/contracts')
  @ApiOperation({ summary: 'List All Contracts in Project' })
  @RequirePermission('project.view')
  findContracts(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findContracts(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Project Details' })
  @RequirePermission('project.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Project' })
  @RequirePermission('project.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateProjectDto
  ) {
    return this.projectService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Project (Soft Delete)' })
  @RequirePermission('project.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }
}
