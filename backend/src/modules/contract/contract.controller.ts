import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { SearchContractDto } from './dto/search-contract.dto';
import { LinkOrganizationDto } from '../organization/dto/link-organization.dto';
import { UpdateLinkedOrganizationRoleDto } from '../organization/dto/update-linked-organization-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create Contract' })
  create(@Body() dto: CreateContractDto) {
    return this.contractService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Contracts (Search & Filter)',
  })
  findAll(@Query() query: SearchContractDto) {
    return this.contractService.findAll(query);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Contract by UUID' })
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.contractService.findOneByUuid(uuid);
  }

  @Patch(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update Contract' })
  update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: UpdateContractDto
  ) {
    return this.contractService.update(uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete Contract' })
  remove(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.contractService.remove(uuid);
  }

  // ---- Contract ↔ Organization Links ----

  @Get(':uuid/organizations')
  @ApiOperation({
    summary: 'List organizations linked to this contract (with role)',
  })
  listOrganizations(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.contractService.listOrganizations(uuid);
  }

  @Post(':uuid/organizations')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Link organization to contract with a role' })
  linkOrganization(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: LinkOrganizationDto
  ) {
    return this.contractService.linkOrganization(uuid, dto);
  }

  @Patch(':uuid/organizations/:orgUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Change role of a linked organization' })
  updateOrganizationRole(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('orgUuid', ParseUuidPipe) orgUuid: string,
    @Body() dto: UpdateLinkedOrganizationRoleDto
  ) {
    return this.contractService.updateOrganizationRole(uuid, orgUuid, dto);
  }

  @Delete(':uuid/organizations/:orgUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Unlink organization from contract' })
  unlinkOrganization(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('orgUuid', ParseUuidPipe) orgUuid: string
  ) {
    return this.contractService.unlinkOrganization(uuid, orgUuid);
  }
}
