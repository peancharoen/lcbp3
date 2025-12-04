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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ContractService } from './contract.service.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

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
    summary: 'Get All Contracts (Optional: filter by projectId)',
  })
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  findAll(@Query('projectId') projectId?: number) {
    return this.contractService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Contract by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update Contract' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto
  ) {
    return this.contractService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete Contract' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contractService.remove(id);
  }
}
