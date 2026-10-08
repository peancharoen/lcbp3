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
import { OrganizationService } from './organization.service';
import { DepartmentService } from './department.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { SearchOrganizationDto } from './dto/search-organization.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly deptService: DepartmentService
  ) {}

  @Post()
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create Organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get All Organizations' })
  findAll(@Query() query: SearchOrganizationDto) {
    return this.orgService.findAll(query);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Organization by UUID' })
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.orgService.findOneByUuid(uuid);
  }

  @Patch(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update Organization' })
  update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.orgService.update(uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete Organization' })
  remove(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.orgService.remove(uuid);
  }

  // ---- Departments (org-scoped) ----

  @Get(':uuid/departments')
  @ApiOperation({ summary: 'List departments of an organization' })
  listDepartments(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.deptService.findAllByOrg(uuid);
  }

  @Post(':uuid/departments')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create department in an organization' })
  createDepartment(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: CreateDepartmentDto
  ) {
    return this.deptService.create(uuid, dto);
  }

  @Patch('departments/:deptUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update department' })
  updateDepartment(
    @Param('deptUuid', ParseUuidPipe) deptUuid: string,
    @Body() dto: UpdateDepartmentDto
  ) {
    return this.deptService.update(deptUuid, dto);
  }

  @Delete('departments/:deptUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Soft delete department' })
  removeDepartment(@Param('deptUuid', ParseUuidPipe) deptUuid: string) {
    return this.deptService.remove(deptUuid);
  }
}
