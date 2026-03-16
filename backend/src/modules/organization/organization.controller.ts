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
import { OrganizationService } from './organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { SearchOrganizationDto } from './dto/search-organization.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

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
}
