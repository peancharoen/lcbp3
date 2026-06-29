// File: src/modules/master/master.controller.ts

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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { RfaType } from '../rfa/entities/rfa-type.entity';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { CreateSubTypeDto } from './dto/create-sub-type.dto';
import { SaveNumberFormatDto } from './dto/save-number-format.dto';

// Import DTOs
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchTagDto } from './dto/search-tag.dto';

@ApiTags('Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // --- Correspondence Types ---
  @Get('correspondence-types')
  @ApiOperation({ summary: 'Get all correspondence types' })
  findAllCorrespondenceTypes() {
    return this.masterService.findAllCorrespondenceTypes();
  }

  @Post('correspondence-types')
  @RequirePermission('master_data.manage')
  createCorrespondenceType(@Body() dto: Partial<CorrespondenceType>) {
    return this.masterService.createCorrespondenceType(dto);
  }

  // --- RFA Types ---
  @Get('rfa-types')
  @ApiOperation({ summary: 'Get all RFA types' })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  findAllRfaTypes(@Query('contractId') contractId?: string | number) {
    return this.masterService.findAllRfaTypes(contractId);
  }

  @Post('rfa-types')
  @RequirePermission('master_data.manage')
  createRfaType(
    @Body() dto: Partial<RfaType> & { contractId: number | string }
  ) {
    return this.masterService.createRfaType(dto);
  }

  // --- Disciplines ---
  @Get('disciplines')
  @ApiOperation({ summary: 'Get all disciplines' })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  findAllDisciplines(@Query('contractId') contractId?: string | number) {
    return this.masterService.findAllDisciplines(contractId);
  }

  @Post('disciplines')
  @RequirePermission('master_data.manage')
  createDiscipline(
    @Body() dto: CreateDisciplineDto & { contractId: number | string }
  ) {
    return this.masterService.createDiscipline(dto);
  }

  @Delete('disciplines/:id')
  @RequirePermission('master_data.manage')
  deleteDiscipline(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteDiscipline(id);
  }

  @Patch('disciplines/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update a discipline' })
  updateDiscipline(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateDisciplineDto> & { contractId?: number | string }
  ) {
    return this.masterService.updateDiscipline(id, dto);
  }

  // --- Sub Types ---
  @Get('sub-types')
  @ApiOperation({ summary: 'Get all sub-types' })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  findAllSubTypes(
    @Query('contractId') contractId?: string | number,
    @Query('typeId') typeId?: number
  ) {
    return this.masterService.findAllSubTypes(contractId, typeId);
  }

  @Post('sub-types')
  @RequirePermission('master_data.manage')
  createSubType(
    @Body() dto: CreateSubTypeDto & { contractId: number | string }
  ) {
    return this.masterService.createSubType(dto);
  }

  // --- Numbering Formats ---
  @Get('numbering-formats')
  @ApiOperation({ summary: 'Get numbering format for project/type' })
  findNumberFormat(
    @Query('projectId') projectId: string | number,
    @Query('typeId', ParseIntPipe) typeId: number
  ) {
    return this.masterService.findNumberFormat(projectId, typeId);
  }

  @Post('numbering-formats')
  @RequirePermission('master_data.manage')
  saveNumberFormat(@Body() dto: SaveNumberFormatDto) {
    return this.masterService.saveNumberFormat(dto);
  }

  // --- Tags ---
  @Get('tags')
  @ApiOperation({ summary: 'Get all tags' })
  findAllTags(@Query() query: SearchTagDto) {
    return this.masterService.findAllTags(query);
  }

  @Get('tags/:id')
  @ApiOperation({ summary: 'Get a tag by ID' })
  findOneTag(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.findOneTag(id);
  }

  @Post('tags')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Create a new tag' })
  createTag(@Body() dto: CreateTagDto, @CurrentUser() user: User) {
    return this.masterService.createTag(dto, user.user_id);
  }

  @Patch('tags/:id')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Update a tag' })
  updateTag(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.masterService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Delete a tag' })
  deleteTag(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteTag(id);
  }
}
