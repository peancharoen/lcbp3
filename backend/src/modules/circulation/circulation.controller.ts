import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CirculationService } from './circulation.service';
import { CreateCirculationDto } from './dto/create-circulation.dto';
import { UpdateCirculationRoutingDto } from './dto/update-circulation-routing.dto';
import { SearchCirculationDto } from './dto/search-circulation.dto';
import { User } from '../user/entities/user.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator'; // Import

@ApiTags('Circulations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('circulations')
export class CirculationController {
  constructor(private readonly circulationService: CirculationService) {}

  @Post()
  @ApiOperation({ summary: 'Create internal circulation' })
  @RequirePermission('circulation.create') // สิทธิ์ ID 41
  @Audit('circulation.create', 'circulation') // ✅ แปะตรงนี้
  create(@Body() createDto: CreateCirculationDto, @CurrentUser() user: User) {
    return this.circulationService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List circulations in my organization' })
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchCirculationDto, @CurrentUser() user: User) {
    return this.circulationService.findAll(searchDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get circulation details' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.circulationService.findOne(id);
  }

  @Patch('routings/:id')
  @ApiOperation({ summary: 'Update my routing task (Complete/Reject)' })
  @RequirePermission('circulation.respond') // สิทธิ์ ID 42
  updateRouting(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCirculationRoutingDto,
    @CurrentUser() user: User,
  ) {
    return this.circulationService.updateRoutingStatus(id, updateDto, user);
  }
}
