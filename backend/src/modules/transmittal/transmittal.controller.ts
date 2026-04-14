import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransmittalService } from './transmittal.service';
import { CreateTransmittalDto } from './dto/create-transmittal.dto';
import { SearchTransmittalDto } from './dto/search-transmittal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { ProjectService } from '../project/project.service';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('Transmittals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('transmittals')
export class TransmittalController {
  constructor(
    private readonly transmittalService: TransmittalService,
    private readonly projectService: ProjectService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Transmittal' })
  @RequirePermission('document.create')
  create(@Body() createDto: CreateTransmittalDto, @CurrentUser() user: User) {
    return this.transmittalService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Search Transmittals' })
  @RequirePermission('document.view')
  async findAll(
    @Query() searchDto: SearchTransmittalDto,
    @CurrentUser() _user: User
  ) {
    // ADR-019: resolve projectUuid → internal INT projectId if needed
    if (searchDto.projectUuid) {
      const project = await this.projectService.findOneByUuid(
        searchDto.projectUuid
      );
      searchDto.projectId = project.id;
    }
    return this.transmittalService.findAll(searchDto);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Transmittal details' })
  @ApiParam({
    name: 'uuid',
    description: 'Transmittal publicId (from correspondences.publicId)',
  })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.transmittalService.findOneByUuid(uuid);
  }

  @Post(':uuid/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit Transmittal to Workflow (with EC-RFA-004 validation)',
  })
  @ApiParam({
    name: 'uuid',
    description: 'Transmittal publicId (from correspondences.publicId)',
  })
  @RequirePermission('document.manage')
  @Audit('transmittal.submit', 'transmittal')
  submit(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User
  ) {
    return this.transmittalService.submit(uuid, user);
  }
}
