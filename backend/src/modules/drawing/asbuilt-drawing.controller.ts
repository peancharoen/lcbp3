import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

// Guards
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';

// Services
import { AsBuiltDrawingService } from './asbuilt-drawing.service';

// DTOs
import { CreateAsBuiltDrawingDto } from './dto/create-asbuilt-drawing.dto';
import { CreateAsBuiltDrawingRevisionDto } from './dto/create-asbuilt-drawing-revision.dto';
import { SearchAsBuiltDrawingDto } from './dto/search-asbuilt-drawing.dto';

// Decorators
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('Drawings - AS Built')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/asbuilt')
export class AsBuiltDrawingController {
  constructor(private readonly asBuiltDrawingService: AsBuiltDrawingService) {}

  @Post()
  @ApiOperation({ summary: 'Create new AS Built Drawing' })
  @ApiResponse({ status: 201, description: 'AS Built Drawing created' })
  @ApiResponse({ status: 409, description: 'Drawing number already exists' })
  @RequirePermission('drawing.create')
  @Audit('drawing.create', 'asbuilt_drawing')
  async create(
    @Body() createDto: CreateAsBuiltDrawingDto,
    @CurrentUser() user: User
  ) {
    return this.asBuiltDrawingService.create(createDto, user);
  }

  @Post(':id/revisions')
  @ApiOperation({ summary: 'Create new revision for AS Built Drawing' })
  @ApiResponse({ status: 201, description: 'Revision created' })
  @ApiResponse({ status: 404, description: 'AS Built Drawing not found' })
  @ApiResponse({ status: 409, description: 'Revision label already exists' })
  async createRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() createDto: CreateAsBuiltDrawingRevisionDto
  ) {
    return this.asBuiltDrawingService.createRevision(id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List AS Built Drawings with search/pagination' })
  @ApiResponse({ status: 200, description: 'List of AS Built Drawings' })
  @RequirePermission('drawing.view')
  async findAll(@Query() searchDto: SearchAsBuiltDrawingDto) {
    return this.asBuiltDrawingService.findAll(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AS Built Drawing by ID' })
  @ApiResponse({ status: 200, description: 'AS Built Drawing details' })
  @ApiResponse({ status: 404, description: 'AS Built Drawing not found' })
  @RequirePermission('drawing.view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.asBuiltDrawingService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete AS Built Drawing' })
  @ApiResponse({ status: 204, description: 'AS Built Drawing deleted' })
  @ApiResponse({ status: 404, description: 'AS Built Drawing not found' })
  @RequirePermission('drawing.delete')
  @Audit('drawing.delete', 'asbuilt_drawing')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User
  ) {
    return this.asBuiltDrawingService.remove(id, user);
  }
}
