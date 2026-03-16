import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ContractDrawingService } from './contract-drawing.service';
import { CreateContractDrawingDto } from './dto/create-contract-drawing.dto';
import { UpdateContractDrawingDto } from './dto/update-contract-drawing.dto';
import { SearchContractDrawingDto } from './dto/search-contract-drawing.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('Contract Drawings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/contract')
export class ContractDrawingController {
  constructor(
    private readonly contractDrawingService: ContractDrawingService
  ) {}

  // Force rebuild for DTO changes

  @Post()
  @ApiOperation({ summary: 'Create new Contract Drawing' })
  @RequirePermission('drawing.create') // สิทธิ์ ID 39: สร้าง/แก้ไขข้อมูลแบบ
  create(
    @Body() createDto: CreateContractDrawingDto,
    @CurrentUser() user: User
  ) {
    return this.contractDrawingService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Search Contract Drawings' })
  @RequirePermission('document.view') // สิทธิ์ ID 31: ดูเอกสารทั่วไป
  findAll(@Query() searchDto: SearchContractDrawingDto) {
    return this.contractDrawingService.findAll(searchDto);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Contract Drawing details' })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.contractDrawingService.findOneByUuid(uuid);
  }

  @Put(':uuid')
  @ApiOperation({ summary: 'Update Contract Drawing' })
  @RequirePermission('drawing.create') // สิทธิ์ ID 39 ครอบคลุมการแก้ไขด้วย
  async update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() updateDto: UpdateContractDrawingDto,
    @CurrentUser() user: User
  ) {
    const drawing = await this.contractDrawingService.findOneByUuid(uuid);
    return this.contractDrawingService.update(drawing.id, updateDto, user);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete Contract Drawing (Soft Delete)' })
  @RequirePermission('document.delete') // สิทธิ์ ID 34: ลบเอกสาร
  async remove(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User
  ) {
    const drawing = await this.contractDrawingService.findOneByUuid(uuid);
    return this.contractDrawingService.remove(drawing.id, user);
  }
}
