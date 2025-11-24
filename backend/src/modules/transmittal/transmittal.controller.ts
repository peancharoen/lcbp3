import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { TransmittalService } from './transmittal.service';
import { CreateTransmittalDto } from './dto/create-transmittal.dto';
import { SearchTransmittalDto } from './dto/search-transmittal.dto'; // เดี๋ยวสร้าง DTO นี้เพิ่มให้ครับถ้ายังไม่มี
import { User } from '../user/entities/user.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator'; // Import

@ApiTags('Transmittals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('transmittals')
export class TransmittalController {
  constructor(private readonly transmittalService: TransmittalService) {}

  @Post()
  @ApiOperation({ summary: 'Create new Transmittal' })
  @RequirePermission('transmittal.create') // สิทธิ์ ID 40
  @Audit('transmittal.create', 'transmittal') // ✅ แปะตรงนี้
  create(@Body() createDto: CreateTransmittalDto, @CurrentUser() user: User) {
    return this.transmittalService.create(createDto, user);
  }

  // เพิ่ม Endpoint พื้นฐานสำหรับการค้นหา (Optional)
  @Get()
  @ApiOperation({ summary: 'Search Transmittals' })
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchTransmittalDto) {
    // return this.transmittalService.findAll(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Transmittal details' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // return this.transmittalService.findOne(id);
  }
}
