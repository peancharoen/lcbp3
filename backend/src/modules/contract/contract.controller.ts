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
import { ContractService } from './contract.service.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { SearchContractDto } from './dto/search-contract.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
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
}
