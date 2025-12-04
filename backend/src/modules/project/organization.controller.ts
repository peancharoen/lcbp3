import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create Organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get All Organizations' })
  findAll() {
    return this.orgService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Organization by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orgService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update Organization' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.orgService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete Organization' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orgService.remove(id);
  }
}
