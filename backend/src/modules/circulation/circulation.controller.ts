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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CirculationService } from './circulation.service';
import { CreateCirculationDto } from './dto/create-circulation.dto';
import { UpdateCirculationRoutingDto } from './dto/update-circulation-routing.dto';
import { SearchCirculationDto } from './dto/search-circulation.dto';
import { ReassignRoutingDto } from './dto/reassign-routing.dto';
import { ForceCloseCirculationDto } from './dto/force-close-circulation.dto';
import { User } from '../user/entities/user.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator'; // Import
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

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

  @Get(':uuid')
  @ApiOperation({ summary: 'Get circulation details' })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.circulationService.findOneByUuid(uuid);
  }

  @Patch('routings/:id')
  @ApiOperation({ summary: 'Update my routing task (Complete/Reject)' })
  @RequirePermission('circulation.respond') // สิทธิ์ ID 42
  updateRouting(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCirculationRoutingDto,
    @CurrentUser() user: User
  ) {
    return this.circulationService.updateRoutingStatus(id, updateDto, user);
  }

  @Patch(':uuid/routing/:routingId/reassign')
  @ApiOperation({
    summary:
      'Re-assign routing to new user when assignee is deactivated (EC-CIRC-001)',
  })
  @ApiParam({ name: 'uuid', description: 'Circulation publicId' })
  @ApiParam({ name: 'routingId', description: 'CirculationRouting INT id' })
  @ApiBody({ type: ReassignRoutingDto })
  @RequirePermission('circulation.manage')
  @Audit('circulation.reassign', 'circulation')
  reassignRouting(
    @Param('routingId', ParseIntPipe) routingId: number,
    @Body() dto: ReassignRoutingDto,
    @CurrentUser() user: User
  ) {
    return this.circulationService.reassignRouting(
      routingId,
      dto.newAssigneeId,
      user
    );
  }

  @Post(':uuid/force-close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force close a Circulation with mandatory reason (EC-CIRC-002)',
  })
  @ApiParam({ name: 'uuid', description: 'Circulation publicId' })
  @ApiBody({ type: ForceCloseCirculationDto })
  @RequirePermission('circulation.manage')
  @Audit('circulation.force_close', 'circulation')
  forceClose(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: ForceCloseCirculationDto,
    @CurrentUser() user: User
  ) {
    return this.circulationService.forceClose(uuid, dto.reason, user);
  }
}
